//! What installing and removing really do. Each step is a plain, visible action: files, a service, a few registry values, shortcuts.
//! Nothing is hidden and nothing outside these paths is touched. Windows commands are run through the tools Windows ships with
//! (sc, reg, icacls, powershell), so that what happens is easy to read and to check by hand.

use crate::payload::{EXTENSION, FILES};
use serde_json::json;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};

pub const SERVICE: &str = "EyeTimeHelper";
const PIPE: &str = r"\\.\pipe\eyetime-helper";
const VERSION: &str = env!("CARGO_PKG_VERSION");
/// the fixed id of the browser extension (its manifest carries the key this comes from)
const EXT_ID: &str = "ohpkalpfhikadmajknogifbcljaennho";
const NATIVE_KEYS: [&str; 3] = [r"HKLM\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.eyetime.helper", r"HKLM\SOFTWARE\Microsoft\Edge\NativeMessagingHosts\com.eyetime.helper", r"HKLM\SOFTWARE\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.eyetime.helper"];
const UNINSTALL_KEY: &str = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\EyeTime";

fn program_files() -> PathBuf {
    std::env::var_os("ProgramFiles").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Program Files"))
}
pub fn install_dir() -> PathBuf {
    program_files().join("EyeTime")
}
fn program_data() -> PathBuf {
    std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
}
fn data_dir() -> PathBuf {
    program_data().join("EyeTime")
}
pub fn desktop_icon_exists() -> bool {
    desktop_link().exists()
}
fn start_menu_link() -> PathBuf {
    program_data().join(r"Microsoft\Windows\Start Menu\Programs\EyeTime.lnk")
}
fn desktop_link() -> PathBuf {
    std::env::var_os("PUBLIC").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Users\Public")).join(r"Desktop\EyeTime.lnk")
}

// ---------- running things ----------

#[cfg(windows)]
fn hide(c: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    c.creation_flags(0x0800_0000)
}
#[cfg(not(windows))]
fn hide(c: &mut Command) -> &mut Command {
    c
}

fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let mut c = Command::new(program);
    hide(c.args(args).stdin(Stdio::null()));
    let out = c.output().map_err(|e| format!("{program}: {e}"))?;
    let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    if out.status.success() { Ok(text) } else { Err(format!("{program} {}: {}", args.join(" "), text.trim())) }
}
fn run_ok(program: &str, args: &[&str]) -> bool {
    run(program, args).is_ok()
}

// ---------- administrator rights ----------

#[cfg(windows)]
pub fn is_admin() -> bool {
    unsafe { windows_sys::Win32::UI::Shell::IsUserAnAdmin() != 0 }
}
#[cfg(not(windows))]
pub fn is_admin() -> bool {
    true
}

#[cfg(windows)]
pub fn relaunch_elevated(args: &[String]) {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    let w = |s: &str| -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() };
    let exe = std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_default();
    let params = args.iter().map(|a| format!("\"{a}\"")).collect::<Vec<_>>().join(" ");
    unsafe {
        ShellExecuteW(std::ptr::null_mut(), w("runas").as_ptr(), w(&exe).as_ptr(), w(&params).as_ptr(), std::ptr::null(), 1);
    }
}
#[cfg(not(windows))]
pub fn relaunch_elevated(_args: &[String]) {}

// ---------- the helper, asked politely ----------

enum Ask {
    Ok,
    Locked,
    Challenge,
}

/// Is the helper willing to be stopped or removed? (Not during a locked block; with the watchdog on, only after the person allowed it in the app.)
fn ask_helper() -> Ask {
    let Ok(f) = std::fs::OpenOptions::new().read(true).write(true).open(PIPE) else { return Ask::Ok };
    let Ok(mut w) = f.try_clone() else { return Ask::Ok };
    let mut r = BufReader::new(f);
    if w.write_all(b"{\"op\":\"uninstall\"}\n").is_err() {
        return Ask::Ok;
    }
    let mut line = String::new();
    if r.read_line(&mut line).unwrap_or(0) == 0 {
        return Ask::Ok;
    }
    let v: serde_json::Value = serde_json::from_str(&line).unwrap_or_default();
    match (v["ok"].as_bool().unwrap_or(false), v["code"].as_str().unwrap_or("")) {
        (true, _) => Ask::Ok,
        (false, "locked") => Ask::Locked,
        _ => Ask::Challenge,
    }
}

fn ping_helper() -> bool {
    let Ok(f) = std::fs::OpenOptions::new().read(true).write(true).open(PIPE) else { return false };
    let Ok(mut w) = f.try_clone() else { return false };
    let mut r = BufReader::new(f);
    if w.write_all(b"{\"op\":\"ping\"}\n").is_err() {
        return false;
    }
    let mut line = String::new();
    r.read_line(&mut line).unwrap_or(0) > 0 && line.contains("\"ok\":true")
}

pub fn service_exists() -> bool {
    run_ok("sc", &["query", SERVICE])
}
fn service_stopped() -> bool {
    run("sc", &["query", SERVICE]).map(|t| t.contains("STOPPED")).unwrap_or(true)
}
fn stop_service() -> bool {
    if !service_exists() || service_stopped() {
        return true;
    }
    let _ = run("sc", &["stop", SERVICE]);
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if service_stopped() {
            return true;
        }
    }
    false
}

type Emit<'a> = &'a dyn Fn(String);
fn step(emit: Emit, index: usize, pct: u32) {
    emit(json!({"type": "step", "index": index, "pct": pct}).to_string());
}

// ---------- install ----------

pub fn install(desktop: bool, emit: Emit) {
    let upgrade = service_exists();
    emit(json!({"type": "start"}).to_string());
    match do_install(desktop, upgrade, emit) {
        Ok(()) => emit(json!({"type": "done"}).to_string()),
        Err(Stop::Blocked(why)) => emit(json!({"type": "blocked", "reason": why}).to_string()),
        Err(Stop::Failed(msg)) => {
            if !upgrade {
                rollback();
            } else {
                // an upgrade that failed must not leave the person without protection: start what is there again
                let _ = run("sc", &["start", SERVICE]);
            }
            emit(json!({"type": "error", "message": msg}).to_string());
        }
    }
}

enum Stop {
    Blocked(&'static str),
    Failed(String),
}
impl From<String> for Stop {
    fn from(s: String) -> Stop {
        Stop::Failed(s)
    }
}

fn do_install(desktop: bool, upgrade: bool, emit: Emit) -> Result<(), Stop> {
    if FILES.is_empty() {
        return Err(Stop::Failed("This installer was built without the program files.".into()));
    }
    // 0. prepare
    step(emit, 0, 4);
    if upgrade {
        match ask_helper() {
            Ask::Locked => return Err(Stop::Blocked("locked")),
            Ask::Challenge => return Err(Stop::Blocked("challenge")),
            Ask::Ok => {}
        }
        if !stop_service() {
            return Err(Stop::Blocked("challenge"));
        }
        let _ = run("taskkill", &["/f", "/im", "eyetime.exe"]);
        // the little program in the person's session and the browsers' native hosts use the helper's file: let go of it
        let _ = run("taskkill", &["/f", "/im", "eyetime-helper.exe"]);
        std::thread::sleep(std::time::Duration::from_millis(600));
    }
    // 1. files
    step(emit, 1, 14);
    let dir = install_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    for (i, (name, bytes)) in FILES.iter().enumerate() {
        std::fs::write(dir.join(name), bytes).map_err(|e| format!("{name}: {e}"))?;
        step(emit, 1, 14 + (30 * (i as u32 + 1)) / FILES.len() as u32);
    }
    let me = std::env::current_exe().map_err(|e| e.to_string())?;
    let target = dir.join("eyetime-setup.exe");
    if me != target {
        std::fs::copy(&me, &target).map_err(|e| format!("eyetime-setup.exe: {e}"))?;
    }
    // 2. the service
    step(emit, 2, 50);
    let helper = dir.join("eyetime-helper.exe");
    let bin = format!("\"{}\" --service", helper.display());
    if upgrade {
        run("sc", &["config", SERVICE, "binPath=", &bin, "start=", "auto"])?;
    } else {
        run("sc", &["create", SERVICE, "binPath=", &bin, "start=", "auto", "DisplayName=", "EyeTime Helper"])?;
    }
    let _ = run("sc", &["description", SERVICE, "Carries out EyeTime blocks: sites, apps and the rules you set. Runs in the background."]);
    // restart by itself if it is ever stopped from outside
    let _ = run("sc", &["failure", SERVICE, "reset=", "86400", "actions=", "restart/1000/restart/1000/restart/5000"]);
    let _ = run("sc", &["failureflag", SERVICE, "1"]);
    // 3. protect
    step(emit, 3, 66);
    let data = data_dir();
    let _ = std::fs::create_dir_all(&data);
    // everyone may read the state; only the system and administrators may change it
    let _ = run("icacls", &[&data.display().to_string(), "/inheritance:r", "/grant:r", "SYSTEM:(OI)(CI)F", "Administrators:(OI)(CI)F", "Users:(OI)(CI)RX"]);
    // the service: system and administrators have it all; signed-in people may look at it and start it, never stop or change it
    let sddl = "D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;LCRPLOCRRC;;;IU)(A;;LCRPLOCRRC;;;SU)";
    let _ = run("sc", &["sdset", SERVICE, sddl]);
    let _ = run("icacls", &[&dir.display().to_string(), "/inheritance:r", "/grant:r", "SYSTEM:(OI)(CI)F", "Administrators:(OI)(CI)F", "Users:(OI)(CI)RX"]);
    // the browser extension: its files, and the note that tells browsers where the native host is
    let extdir = dir.join("extension");
    std::fs::create_dir_all(&extdir).map_err(|e| format!("extension: {e}"))?;
    for (name, bytes) in EXTENSION {
        std::fs::write(extdir.join(name), bytes).map_err(|e| format!("extension\\{name}: {e}"))?;
    }
    let manifest = json!({"name": "com.eyetime.helper", "description": "EyeTime helper", "path": helper.display().to_string(), "type": "stdio", "allowed_origins": [format!("chrome-extension://{EXT_ID}/")]});
    let mpath = dir.join("native-host.json");
    std::fs::write(&mpath, serde_json::to_string_pretty(&manifest).unwrap_or_default()).map_err(|e| format!("native-host.json: {e}"))?;
    for key in NATIVE_KEYS {
        for view in ["/reg:64", "/reg:32"] {
            let _ = run("reg", &["add", key, "/ve", "/t", "REG_SZ", "/d", &mpath.display().to_string(), "/f", view]);
        }
    }
    // 4. shortcuts and the entry in "Apps & features"
    step(emit, 4, 80);
    let app = dir.join("eyetime.exe");
    make_shortcut(&start_menu_link(), &app)?;
    if desktop {
        let _ = make_shortcut(&desktop_link(), &app);
    }
    let setup = dir.join("eyetime-setup.exe");
    let key = UNINSTALL_KEY;
    let uninstall = format!("\"{}\" --uninstall", setup.display());
    for (name, kind, value) in [
        ("DisplayName", "REG_SZ", "EyeTime".to_string()),
        ("DisplayVersion", "REG_SZ", VERSION.to_string()),
        ("Publisher", "REG_SZ", "EyeTime".to_string()),
        ("InstallLocation", "REG_SZ", dir.display().to_string()),
        ("DisplayIcon", "REG_SZ", app.display().to_string()),
        ("UninstallString", "REG_SZ", uninstall),
        ("NoModify", "REG_DWORD", "1".to_string()),
        ("NoRepair", "REG_DWORD", "1".to_string()),
    ] {
        run("reg", &["add", key, "/v", name, "/t", kind, "/d", &value, "/f"])?;
    }
    // 5. start, and make sure it answers
    step(emit, 5, 90);
    let _ = run("sc", &["start", SERVICE]);
    let mut up = false;
    for _ in 0..40 {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if ping_helper() {
            up = true;
            break;
        }
    }
    if !up {
        return Err(Stop::Failed("The blocking engine did not start. Windows may have blocked it (check your antivirus).".into()));
    }
    Ok(())
}

fn make_shortcut(link: &PathBuf, target: &PathBuf) -> Result<(), String> {
    if let Some(d) = link.parent() {
        let _ = std::fs::create_dir_all(d);
    }
    let script = format!(
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{}');$s.TargetPath='{}';$s.WorkingDirectory='{}';$s.Description='EyeTime';$s.Save()",
        link.display().to_string().replace('\'', "''"),
        target.display().to_string().replace('\'', "''"),
        target.parent().map(|p| p.display().to_string()).unwrap_or_default().replace('\'', "''")
    );
    run("powershell", &["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script]).map(|_| ())
}

/// a failed first install leaves nothing behind
fn rollback() {
    let _ = run("sc", &["stop", SERVICE]);
    let _ = run("sc", &["delete", SERVICE]);
    let _ = run("reg", &["delete", UNINSTALL_KEY, "/f"]);
    let _ = std::fs::remove_file(start_menu_link());
    let _ = std::fs::remove_file(desktop_link());
    for (name, _) in FILES {
        let _ = std::fs::remove_file(install_dir().join(name));
    }
    let _ = std::fs::remove_file(install_dir().join("eyetime-setup.exe"));
    let _ = std::fs::remove_dir(install_dir());
}

// ---------- uninstall ----------

pub fn uninstall(delete_data: bool, emit: Emit) {
    emit(json!({"type": "start"}).to_string());
    match do_uninstall(delete_data, emit) {
        Ok(()) => emit(json!({"type": "done"}).to_string()),
        Err(Stop::Blocked(why)) => emit(json!({"type": "blocked", "reason": why}).to_string()),
        Err(Stop::Failed(msg)) => emit(json!({"type": "error", "message": msg}).to_string()),
    }
}

fn do_uninstall(delete_data: bool, emit: Emit) -> Result<(), Stop> {
    step(emit, 0, 5);
    match ask_helper() {
        Ask::Locked => return Err(Stop::Blocked("locked")),
        Ask::Challenge => return Err(Stop::Blocked("challenge")),
        Ask::Ok => {}
    }
    step(emit, 1, 20);
    if !stop_service() {
        return Err(Stop::Blocked("challenge"));
    }
    let _ = run("taskkill", &["/f", "/im", "eyetime.exe"]);
    let _ = run("taskkill", &["/f", "/im", "eyetime-helper.exe"]);
    let dir = install_dir();
    // lift every trace of a block: the hosts file, the policies, the safe-mode entry
    step(emit, 2, 45);
    let helper = dir.join("eyetime-helper.exe");
    if helper.exists() {
        let _ = run(&helper.display().to_string(), &["--cleanup"]);
    }
    for net in ["Minimal", "Network"] {
        let _ = run("reg", &["delete", &format!(r"HKLM\SYSTEM\CurrentControlSet\Control\SafeBoot\{net}\{SERVICE}"), "/f"]);
    }
    let _ = run("sc", &["delete", SERVICE]);
    for key in NATIVE_KEYS {
        for view in ["/reg:64", "/reg:32"] {
            let _ = run("reg", &["delete", key, "/f", view]);
        }
    }
    let _ = std::fs::remove_dir_all(dir.join("extension"));
    let _ = std::fs::remove_file(dir.join("native-host.json"));
    // files
    step(emit, 3, 70);
    let _ = std::fs::remove_file(start_menu_link());
    let _ = std::fs::remove_file(desktop_link());
    let _ = run("reg", &["delete", UNINSTALL_KEY, "/f"]);
    let _ = run("reg", &["delete", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", "EyeTime", "/f"]);
    for (name, _) in FILES {
        remove_with_retries(&dir.join(name));
    }
    remove_with_retries(&helper);
    // the little files the app keeps
    if delete_data {
        let _ = std::fs::remove_dir_all(data_dir());
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let _ = std::fs::remove_dir_all(PathBuf::from(appdata).join("EyeTime"));
        }
    }
    step(emit, 4, 92);
    Ok(())
}

fn remove_with_retries(p: &PathBuf) {
    for _ in 0..10 {
        if !p.exists() || std::fs::remove_file(p).is_ok() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }
}

/// this program removes its own folder after it has exited
pub fn remove_self_later() {
    let dir = install_dir();
    let cmd = format!("ping -n 4 127.0.0.1 >nul & rmdir /s /q \"{}\"", dir.display());
    let mut c = Command::new("cmd");
    hide(c.args(["/c", &cmd]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()));
    let _ = c.spawn();
}

/// start the app as the person who is signed in, not as the administrator that installed it
pub fn open_app() {
    let app = install_dir().join("eyetime.exe");
    let mut c = Command::new("explorer.exe");
    hide(c.arg(app));
    let _ = c.spawn();
}
