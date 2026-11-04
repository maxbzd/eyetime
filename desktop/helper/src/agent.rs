//! The agent: a tiny program in the person's own session. The service cannot see windows (it lives in session 0),
//! so the agent looks at the screen and reports, and does the few things that only work from inside the session.

use crate::os_windows::{run_quiet, wide_to_string};
use crate::supervisor::is_private_window;
use eyetime_core::ipc::{Fg, Orders, Request, Response, Win, MAX_LINE, PIPE_NAME};
use std::io::{BufRead, BufReader, Read, Write};
use std::time::Duration;

use windows_sys::core::BOOL;
use windows_sys::Win32::Foundation::{CloseHandle, HWND, LPARAM};
const TRUE: BOOL = 1;
use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows_sys::Win32::System::SystemInformation::GetTickCount;
use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, GetForegroundWindow, GetWindow, GetWindowLongW, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, PostMessageW, GWL_EXSTYLE, GW_OWNER, WM_CLOSE, WS_EX_TOOLWINDOW};

fn exe_of(pid: u32) -> String {
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return String::new();
        }
        let mut buf = [0u16; 520];
        let mut n = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut n);
        CloseHandle(h);
        if ok == 0 {
            return String::new();
        }
        let full = wide_to_string(&buf[..n as usize]);
        full.rsplit(['\\', '/']).next().unwrap_or("").to_string()
    }
}

fn title_of(hwnd: HWND) -> String {
    unsafe {
        let mut buf = [0u16; 512];
        let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        wide_to_string(&buf[..n.max(0) as usize])
    }
}

fn foreground() -> Option<Fg> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        Some(Fg { exe: exe_of(pid), title: title_of(hwnd), pid })
    }
}

fn idle_secs() -> u32 {
    unsafe {
        let mut li = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
        if GetLastInputInfo(&mut li) == 0 {
            return 0;
        }
        GetTickCount().wrapping_sub(li.dwTime) / 1000
    }
}

unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let list = &mut *(lparam as *mut Vec<(usize, Win)>);
    if IsWindowVisible(hwnd) == 0 || !GetWindow(hwnd, GW_OWNER).is_null() {
        return TRUE;
    }
    if (GetWindowLongW(hwnd, GWL_EXSTYLE) as u32) & WS_EX_TOOLWINDOW != 0 {
        return TRUE;
    }
    let mut cloaked = 0u32;
    DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, &mut cloaked as *mut u32 as *mut _, 4);
    if cloaked != 0 {
        return TRUE;
    }
    let title = title_of(hwnd);
    if title.is_empty() {
        return TRUE;
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, &mut pid);
    list.push((hwnd as usize, Win { exe: exe_of(pid), title, pid }));
    TRUE
}

fn windows() -> Vec<(usize, Win)> {
    let mut list: Vec<(usize, Win)> = Vec::new();
    unsafe {
        EnumWindows(Some(collect), &mut list as *mut _ as LPARAM);
    }
    list
}

fn set_dnd(on: bool) {
    // pop-up notifications off while a session asks for quiet
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings";
    run_quiet("reg", &["add", key, "/v", "NOC_GLOBAL_SETTING_TOASTS_ENABLED", "/t", "REG_DWORD", "/d", if on { "0" } else { "1" }, "/f"]);
}

pub fn run() {
    // only one agent per session
    let mut dnd = false;
    loop {
        let result = std::fs::OpenOptions::new().read(true).write(true).open(PIPE_NAME);
        let Ok(pipe) = result else {
            std::thread::sleep(Duration::from_secs(3));
            continue;
        };
        let Ok(mut out) = pipe.try_clone() else { continue };
        let mut reader = BufReader::new(pipe);
        loop {
            let wins = windows();
            let req = Request::Observe { fg: foreground(), idle_secs: idle_secs(), windows: wins.iter().map(|w| w.1.clone()).collect(), screen_locked: false };
            let mut text = serde_json::to_string(&req).unwrap_or_default();
            text.push('\n');
            if out.write_all(text.as_bytes()).is_err() {
                break;
            }
            let mut line = String::new();
            match reader.by_ref().take(MAX_LINE as u64).read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {}
            }
            if let Ok(resp) = serde_json::from_str::<Response>(&line) {
                if let Ok(orders) = serde_json::from_value::<Orders>(resp.data) {
                    if orders.close_private {
                        for (hwnd, w) in wins.iter().filter(|(_, w)| is_private_window(w)) {
                            let _ = w;
                            unsafe {
                                PostMessageW(*hwnd as HWND, WM_CLOSE, 0, 0);
                            }
                        }
                    }
                    if orders.dnd != dnd {
                        set_dnd(orders.dnd);
                        dnd = orders.dnd;
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(2));
        }
    }
}

/// The browser extension talks to this program through the browser's own messaging (4-byte length, then JSON).
/// Every message is forwarded to the helper as it is, and the helper's answer is sent back.
pub fn native_host() {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut input = stdin.lock();
    let mut output = stdout.lock();
    let mut pipe: Option<(std::fs::File, BufReader<std::fs::File>)> = None;
    loop {
        let mut len = [0u8; 4];
        if input.read_exact(&mut len).is_err() {
            return;
        }
        let n = u32::from_le_bytes(len) as usize;
        if n == 0 || n > 1024 * 1024 {
            return;
        }
        let mut buf = vec![0u8; n];
        if input.read_exact(&mut buf).is_err() {
            return;
        }
        let reply = (|| -> Option<String> {
            // anything the extension sends has to be a request we know
            let req: Request = serde_json::from_slice(&buf).ok()?;
            // the extension only reports what is in front and asks what is closed
            if !matches!(req, Request::Site { .. } | Request::Decision | Request::Ping | Request::Status) {
                return Some(serde_json::to_string(&Response::err("denied", "not for the extension")).ok()?);
            }
            if pipe.is_none() {
                let f = std::fs::OpenOptions::new().read(true).write(true).open(PIPE_NAME).ok()?;
                pipe = Some((f.try_clone().ok()?, BufReader::new(f)));
            }
            let (w, r) = pipe.as_mut()?;
            let mut text = serde_json::to_string(&req).ok()?;
            text.push('\n');
            if w.write_all(text.as_bytes()).is_err() {
                pipe = None;
                return None;
            }
            let mut line = String::new();
            if r.by_ref().take(MAX_LINE as u64).read_line(&mut line).ok()? == 0 {
                pipe = None;
                return None;
            }
            Some(line.trim().to_string())
        })()
        .unwrap_or_else(|| serde_json::to_string(&Response::err("offline", "EyeTime is not running")).unwrap_or_default());
        let bytes = reply.as_bytes();
        if output.write_all(&(bytes.len() as u32).to_le_bytes()).is_err() || output.write_all(bytes).is_err() || output.flush().is_err() {
            return;
        }
    }
}
