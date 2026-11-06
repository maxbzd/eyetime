//! The named pipe the window, the agent and the browser extension talk to, and the loop that ticks the supervisor.

use crate::limits::Limiter;
use crate::os_windows::{pipe_client_role, spawn_agent, WinNet, WinOs};
use crate::supervisor::Supervisor;
use crate::update::Updater;
use eyetime_core::ipc::{parse_request, Response, Role, MAX_LINE, PIPE_NAME};
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::io::FromRawHandle;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use windows_sys::Win32::Foundation::{LocalFree, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
use windows_sys::Win32::Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX};
use windows_sys::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
    PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};
use windows_sys::Win32::System::IO::CancelIoEx;

pub type Shared = Arc<Mutex<Supervisor<WinOs>>>;

pub fn lock(s: &Shared) -> MutexGuard<'_, Supervisor<WinOs>> {
    s.lock().unwrap_or_else(|e| e.into_inner())
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// System and administrators: everything. Signed-in users: read and write (they are the window and the agent).
const SDDL: &str = "D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;AU)";

pub fn run_ticker(sup: Shared, stop: Arc<AtomicBool>) {
    let mut last_spawn = std::time::Instant::now() - Duration::from_secs(60);
    while !stop.load(Ordering::Relaxed) {
        let alive = {
            let mut s = lock(&sup);
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| s.tick()));
            if r.is_err() {
                crate::os::Os::log(&s.os, "tick panicked");
            }
            s.agent_alive()
        };
        if !alive && last_spawn.elapsed() > Duration::from_secs(15) {
            last_spawn = std::time::Instant::now();
            spawn_agent();
        }
        std::thread::sleep(Duration::from_secs(2));
    }
}

/// looks for a newer version now and then, and fetches it when it is wanted (its own thread: the network may be slow)
pub fn run_updater(sup: Shared, stop: Arc<AtomicBool>) {
    let shared = lock(&sup).upd.clone();
    let u = Updater::new(WinNet, shared, crate::supervisor::VERSION);
    // the first look comes a little after the start, when the network is surely up
    for _ in 0..45 {
        if stop.load(Ordering::Relaxed) {
            return;
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    while !stop.load(Ordering::Relaxed) {
        let now = crate::os::Os::mono_ms(&WinOs);
        if std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| u.step(now))).is_err() {
            crate::os::Os::log(&WinOs, "update step panicked");
        }
        std::thread::sleep(Duration::from_secs(1));
    }
}

pub fn run_pipe_server(sup: Shared, stop: Arc<AtomicBool>) {
    let name = wide(PIPE_NAME);
    let sddl = wide(SDDL);
    let mut first = true;
    let limiter = Arc::new(Limiter::default());
    {
        let (limiter, stop) = (limiter.clone(), stop.clone());
        std::thread::spawn(move || run_reaper(limiter, stop));
    }
    while !stop.load(Ordering::Relaxed) {
        unsafe {
            let mut sd: *mut core::ffi::c_void = std::ptr::null_mut();
            if ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut sd,
                std::ptr::null_mut(),
            ) == 0
            {
                std::thread::sleep(Duration::from_secs(2));
                continue;
            }
            let sa = SECURITY_ATTRIBUTES {
                nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: sd,
                bInheritHandle: 0,
            };
            // the first instance is created with FIRST_PIPE_INSTANCE so that nobody can squat on the name before us
            let mode = PIPE_ACCESS_DUPLEX
                | if first {
                    FILE_FLAG_FIRST_PIPE_INSTANCE
                } else {
                    0
                };
            let h = CreateNamedPipeW(
                name.as_ptr(),
                mode,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES,
                64 * 1024,
                64 * 1024,
                0,
                &sa,
            );
            LocalFree(sd);
            if h == INVALID_HANDLE_VALUE {
                std::thread::sleep(Duration::from_secs(2));
                continue;
            }
            first = false;
            // ERROR_PIPE_CONNECTED (a client connected between create and connect) also counts as connected
            let connected = ConnectNamedPipe(h, std::ptr::null_mut()) != 0
                || windows_sys::Win32::Foundation::GetLastError() == 535;
            if !connected || stop.load(Ordering::Relaxed) {
                drop(File::from_raw_handle(h as _));
                continue;
            }
            // who is there is read from the system now, while the connection is fresh
            let role = pipe_client_role(h);
            // a kind of client that already holds all the room it may have is turned away at once
            let Some(id) = limiter.admit(role, h as usize, now_ms()) else {
                drop(File::from_raw_handle(h as _));
                continue;
            };
            let file = File::from_raw_handle(h as _);
            let (sup, limiter) = (sup.clone(), limiter.clone());
            std::thread::spawn(move || serve(file, sup, role, limiter, id));
        }
    }
}

fn now_ms() -> i64 {
    crate::os::Os::mono_ms(&WinOs)
}

/// Cuts the connections of unknown programs that hold the pipe without asking for anything (a read that is waiting is cancelled and ends).
fn run_reaper(limiter: Arc<Limiter>, stop: Arc<AtomicBool>) {
    while !stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_secs(2));
        limiter.cancel_overdue(now_ms(), |token| unsafe {
            CancelIoEx(token as _, std::ptr::null());
        });
    }
}

fn serve(file: File, sup: Shared, role: Role, limiter: Arc<Limiter>, id: u64) {
    serve_requests(&file, &sup, role, &limiter, id);
    // before the handle is closed (when `file` goes out of scope), so that the reaper can never use a number that is gone
    limiter.release(id);
}

fn serve_requests(file: &File, sup: &Shared, role: Role, limiter: &Limiter, id: u64) {
    let Ok(mut out) = file.try_clone() else {
        return;
    };
    let mut reader = BufReader::new(file);
    loop {
        let mut line = String::new();
        match reader
            .by_ref()
            .take(MAX_LINE as u64 + 1)
            .read_line(&mut line)
        {
            Ok(0) | Err(_) => return,
            Ok(_) => {}
        }
        let resp = match parse_request(&line) {
            Ok(req) if !role.allows(&req) => {
                Response::err("denied", "This program may not ask for that")
            }
            Ok(req) => {
                let mut s = lock(sup);
                std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| s.handle(req)))
                    .unwrap_or_else(|_| Response::err("internal", "internal error"))
            }
            Err(e) => Response::err("bad_request", e),
        };
        let mut text = serde_json::to_string(&resp)
            .unwrap_or_else(|_| "{\"ok\":false,\"code\":\"internal\"}".into());
        text.push('\n');
        if out.write_all(text.as_bytes()).is_err() || out.flush().is_err() {
            return;
        }
        limiter.touch(id, now_ms());
    }
}

/// wake the accept loop so that it can see the stop flag
pub fn poke() {
    let _ = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(PIPE_NAME);
}
