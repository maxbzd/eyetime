//! The real computer. Everything here is thin: ask Windows, do what the supervisor said.

use crate::os::{Os, Proc};
use std::ffi::OsString;
use std::io::{self, Write};
use std::os::windows::ffi::OsStringExt;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
use windows_sys::Win32::System::Power::{SetThreadExecutionState, ES_CONTINUOUS, ES_SYSTEM_REQUIRED};
use windows_sys::Win32::System::SystemInformation::{GetLocalTime, GetSystemTime};
use windows_sys::Win32::System::WindowsProgramming::QueryInterruptTime;
use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CLEANBOOT};
use windows_sys::Win32::Foundation::SYSTEMTIME;

const NO_WINDOW: u32 = 0x0800_0000;

pub struct WinOs;

pub fn data_dir() -> PathBuf {
    let base = std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
    base.join("EyeTime")
}

fn hosts_path() -> PathBuf {
    let root = std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    root.join(r"System32\drivers\etc\hosts")
}

pub fn run_quiet(program: &str, args: &[&str]) -> bool {
    Command::new(program).args(args).creation_flags(NO_WINDOW).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).status().map(|s| s.success()).unwrap_or(false)
}

fn days(y: i64, m: i64, d: i64) -> i64 {
    // days since 1970-01-01
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn st_ms(s: &SYSTEMTIME) -> i64 {
    days(s.wYear as i64, s.wMonth as i64, s.wDay as i64) * 86_400_000 + s.wHour as i64 * 3_600_000 + s.wMinute as i64 * 60_000 + s.wSecond as i64 * 1000
}

pub fn wide_to_string(w: &[u16]) -> String {
    let n = w.iter().position(|c| *c == 0).unwrap_or(w.len());
    OsString::from_wide(&w[..n]).to_string_lossy().into_owned()
}

impl Os for WinOs {
    fn wall_ms(&self) -> i64 {
        SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
    }
    fn mono_ms(&self) -> i64 {
        // interrupt time counts the time the computer slept too, in 100 ns steps; the person cannot set it
        let mut t = 0u64;
        unsafe { QueryInterruptTime(&mut t) };
        (t / 10_000) as i64
    }
    fn tz_offset_ms(&self) -> i64 {
        unsafe {
            let (mut l, mut u): (SYSTEMTIME, SYSTEMTIME) = std::mem::zeroed();
            GetLocalTime(&mut l);
            GetSystemTime(&mut u);
            let diff = st_ms(&l) - st_ms(&u);
            // the two readings are a few ms apart: round to the quarter hour
            let q = 15 * 60_000;
            ((diff + q / 2).div_euclid(q)) * q
        }
    }

    fn read_hosts(&self) -> io::Result<String> {
        let bytes = std::fs::read(hosts_path())?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    }
    fn write_hosts(&self, text: &str) -> io::Result<()> {
        let p = hosts_path();
        // the original file is kept once, before we ever touch it
        let backup = data_dir().join("hosts.original");
        if !backup.exists() {
            if let Ok(orig) = std::fs::read(&p) {
                if !String::from_utf8_lossy(&orig).contains(eyetime_core::hosts::BEGIN) {
                    let _ = std::fs::create_dir_all(data_dir());
                    let _ = std::fs::write(&backup, orig);
                }
            }
        }
        if let Ok(meta) = std::fs::metadata(&p) {
            let mut perm = meta.permissions();
            if perm.readonly() {
                perm.set_readonly(false);
                let _ = std::fs::set_permissions(&p, perm);
            }
        }
        // write beside it and swap, so that a failure half way never leaves a broken file; if the swap is refused, write in place
        let tmp = p.with_file_name("hosts.eyetime-new");
        if std::fs::write(&tmp, text.as_bytes()).is_ok() && std::fs::rename(&tmp, &p).is_ok() {
            return Ok(());
        }
        let _ = std::fs::remove_file(&tmp);
        std::fs::write(&p, text.as_bytes())
    }
    fn flush_dns(&self) {
        run_quiet("ipconfig", &["/flushdns"]);
    }

    fn processes(&self) -> Vec<Proc> {
        let mut out = Vec::new();
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snap == INVALID_HANDLE_VALUE {
                return out;
            }
            let mut e: PROCESSENTRY32W = std::mem::zeroed();
            e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            let mut ok = Process32FirstW(snap, &mut e);
            while ok != 0 {
                out.push(Proc { pid: e.th32ProcessID, exe: wide_to_string(&e.szExeFile) });
                ok = Process32NextW(snap, &mut e);
            }
            CloseHandle(snap);
        }
        out
    }
    fn terminate(&self, pid: u32) -> bool {
        unsafe {
            let h = OpenProcess(PROCESS_TERMINATE, 0, pid);
            if h.is_null() {
                return false;
            }
            let r = TerminateProcess(h, 1);
            CloseHandle(h);
            r != 0
        }
    }
    fn own_pid(&self) -> u32 {
        std::process::id()
    }

    fn set_taskmgr_locked(&self, on: bool) {
        let key = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System";
        if on {
            run_quiet("reg", &["add", key, "/v", "DisableTaskMgr", "/t", "REG_DWORD", "/d", "1", "/f"]);
        } else {
            run_quiet("reg", &["delete", key, "/v", "DisableTaskMgr", "/f"]);
        }
    }
    fn set_firefox_doh_off(&self, on: bool) {
        let key = r"HKLM\SOFTWARE\Policies\Mozilla\Firefox\DNSOverHTTPS";
        if on {
            run_quiet("reg", &["add", key, "/v", "Enabled", "/t", "REG_DWORD", "/d", "0", "/f"]);
            run_quiet("reg", &["add", key, "/v", "Locked", "/t", "REG_DWORD", "/d", "1", "/f"]);
        } else {
            run_quiet("reg", &["delete", key, "/f"]);
        }
    }
    fn set_keep_awake(&self, on: bool) {
        unsafe {
            SetThreadExecutionState(if on { ES_CONTINUOUS | ES_SYSTEM_REQUIRED } else { ES_CONTINUOUS });
        }
    }
    fn set_safeboot(&self, on: bool) {
        for net in ["Minimal", "Network"] {
            let key = format!(r"HKLM\SYSTEM\CurrentControlSet\Control\SafeBoot\{net}\EyeTimeHelper");
            if on {
                run_quiet("reg", &["add", &key, "/ve", "/d", "Service", "/f"]);
            } else {
                run_quiet("reg", &["delete", &key, "/f"]);
            }
        }
    }
    fn in_safe_mode(&self) -> bool {
        unsafe { GetSystemMetrics(SM_CLEANBOOT) != 0 }
    }

    fn read_store(&self) -> Option<String> {
        std::fs::read_to_string(data_dir().join("helper.json")).ok()
    }
    fn write_store(&self, text: &str) -> io::Result<()> {
        let dir = data_dir();
        std::fs::create_dir_all(&dir)?;
        let tmp = dir.join("helper.json.tmp");
        std::fs::write(&tmp, text)?;
        std::fs::rename(&tmp, dir.join("helper.json"))
    }
    fn log(&self, line: &str) {
        let dir = data_dir();
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("helper.log");
        if std::fs::metadata(&path).map(|m| m.len() > 512 * 1024).unwrap_or(false) {
            let _ = std::fs::rename(&path, dir.join("helper.old.log"));
        }
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "{} {}", SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0), line);
        }
    }
}

/// Start the agent inside the person's own session (the service itself lives in session 0 and sees no windows).
pub fn spawn_agent() -> bool {
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::System::RemoteDesktop::{WTSGetActiveConsoleSessionId, WTSQueryUserToken};
    use windows_sys::Win32::System::Threading::{CreateProcessAsUserW, CREATE_NO_WINDOW, PROCESS_INFORMATION, STARTUPINFOW};
    unsafe {
        let sid = WTSGetActiveConsoleSessionId();
        if sid == 0xFFFF_FFFF {
            return false;
        }
        let mut token: HANDLE = std::ptr::null_mut();
        if WTSQueryUserToken(sid, &mut token) == 0 {
            return false;
        }
        let exe = match std::env::current_exe() {
            Ok(p) => p,
            Err(_) => {
                CloseHandle(token);
                return false;
            }
        };
        let mut cmd: Vec<u16> = format!("\"{}\" --agent", exe.display()).encode_utf16().chain(std::iter::once(0)).collect();
        let mut desktop: Vec<u16> = "winsta0\\default".encode_utf16().chain(std::iter::once(0)).collect();
        let mut si: STARTUPINFOW = std::mem::zeroed();
        si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
        si.lpDesktop = desktop.as_mut_ptr();
        let mut pi: PROCESS_INFORMATION = std::mem::zeroed();
        let ok = CreateProcessAsUserW(token, std::ptr::null(), cmd.as_mut_ptr(), std::ptr::null(), std::ptr::null(), 0, CREATE_NO_WINDOW, std::ptr::null(), std::ptr::null(), &si, &mut pi);
        CloseHandle(token);
        if ok == 0 {
            return false;
        }
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        true
    }
}

/// Put everything back as it was: no block in the hosts file, task manager and Firefox policies cleared.
/// The uninstaller runs this after the service is gone; it is also the first thing to try if something ever seems stuck.
pub fn cleanup_all() {
    let os = WinOs;
    if let Ok(cur) = os.read_hosts() {
        if !eyetime_core::hosts::is_current(&cur, &[]) {
            let _ = os.write_hosts(&eyetime_core::hosts::render(&cur, &[]));
            os.flush_dns();
        }
    }
    os.set_taskmgr_locked(false);
    os.set_firefox_doh_off(false);
    os.set_keep_awake(false);
}
