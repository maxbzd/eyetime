//! eyetime-helper.exe
//!   --service      run as the Windows service (the service manager starts it this way)
//!   --console      run in the foreground, for trying things out
//!   --agent        the little program inside the person's session (the service starts it)
//!   --native-host  the end of the browser extension's messaging channel
//!   --cleanup      remove every trace of a block (run after stopping the service)

#[cfg(windows)]
mod win {
    use eyetime_helper::os::Os;
    use eyetime_helper::os_windows::WinOs;
    use eyetime_helper::server::{lock, poke, run_pipe_server, run_ticker, Shared};
    use eyetime_helper::supervisor::Supervisor;
    use std::ffi::OsString;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Arc, Mutex};
    use std::time::Duration;
    use windows_service::service::{ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus, ServiceType};
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
    use windows_service::{define_windows_service, service_dispatcher};

    pub const SERVICE_NAME: &str = "EyeTimeHelper";

    define_windows_service!(ffi_service_main, service_main);

    pub fn run_service() {
        let _ = service_dispatcher::start(SERVICE_NAME, ffi_service_main);
    }

    fn service_main(_args: Vec<OsString>) {
        if let Err(e) = service_body() {
            WinOs.log(&format!("service: {e}"));
        }
    }

    fn start_threads(sup: &Shared, stop: &Arc<AtomicBool>) {
        let (a, b) = (sup.clone(), stop.clone());
        std::thread::spawn(move || run_ticker(a, b));
        let (a, b) = (sup.clone(), stop.clone());
        std::thread::spawn(move || run_pipe_server(a, b));
    }

    fn service_body() -> windows_service::Result<()> {
        let (tx, rx) = mpsc::channel::<ServiceControl>();
        let handle = service_control_handler::register(SERVICE_NAME, move |ev| match ev {
            ServiceControl::Stop | ServiceControl::Shutdown | ServiceControl::Preshutdown => {
                let _ = tx.send(ev);
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        })?;
        let status = |state: ServiceState, accept: ServiceControlAccept| ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: state,
            controls_accepted: accept,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::from_secs(10),
            process_id: None,
        };
        let sup: Shared = Arc::new(Mutex::new(Supervisor::new(WinOs)));
        let stop = Arc::new(AtomicBool::new(false));
        start_threads(&sup, &stop);
        handle.set_service_status(status(ServiceState::Running, ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN | ServiceControlAccept::PRESHUTDOWN))?;
        let keep_blocks = loop {
            match rx.recv() {
                Ok(ServiceControl::Stop) => {
                    // a locked block, or the watchdog, say no: the service just keeps running
                    if lock(&sup).may_stop() {
                        break false;
                    }
                    WinOs.log("stop refused");
                }
                Ok(_) => break true, // the computer is shutting down: leave the blocks in place for the next start
                Err(_) => break true,
            }
        };
        handle.set_service_status(status(ServiceState::StopPending, ServiceControlAccept::empty()))?;
        stop.store(true, Ordering::Relaxed);
        poke();
        lock(&sup).shutdown(keep_blocks);
        handle.set_service_status(status(ServiceState::Stopped, ServiceControlAccept::empty()))?;
        Ok(())
    }

    pub fn run_console() {
        let sup: Shared = Arc::new(Mutex::new(Supervisor::new(WinOs)));
        let stop = Arc::new(AtomicBool::new(false));
        start_threads(&sup, &stop);
        println!("EyeTime helper is running in the console. Press Enter to stop.");
        let mut s = String::new();
        let _ = std::io::stdin().read_line(&mut s);
        stop.store(true, Ordering::Relaxed);
        poke();
        lock(&sup).shutdown(false);
    }
}

fn main() {
    let arg = std::env::args().nth(1).unwrap_or_default();
    #[cfg(windows)]
    match arg.as_str() {
        "--service" => win::run_service(),
        "--console" => win::run_console(),
        "--agent" => eyetime_helper::agent::run(),
        "--native-host" => eyetime_helper::agent::native_host(),
        // a browser starts a native host with the address of the extension as its first argument
        o if o.starts_with("chrome-extension://") || o.starts_with("moz-extension://") => eyetime_helper::agent::native_host(),
        "--cleanup" => {
            eyetime_helper::os_windows::cleanup_all();
            println!("EyeTime blocks removed from the hosts file and the system policies.");
        }
        _ => println!("eyetime-helper --service | --console | --agent | --native-host"),
    }
    #[cfg(not(windows))]
    {
        let _ = arg;
        println!("The EyeTime helper runs on Windows only.");
    }
}
