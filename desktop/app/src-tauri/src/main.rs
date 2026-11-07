// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! EyeTime, the window. It shows what the helper (the Windows service) knows and asks it to do things; it closes nothing itself.
//! Closing this window, or quitting it, never ends a block: the helper runs on.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod nudge;

use serde_json::{json, Value};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::ManagerExt;

const PIPE: &str = r"\\.\pipe\eyetime-helper";
const KEYS: [&str; 8] = [
    "et-rules",
    "et-items",
    "et-limits",
    "et-auto",
    "et-cats",
    "et-kw",
    "et-ex",
    "et-protect",
];

/// one connection to the helper, opened when needed and again after any break
struct Link(Mutex<Option<(File, BufReader<File>)>>);

fn open_link() -> Result<(File, BufReader<File>), String> {
    let f = OpenOptions::new()
        .read(true)
        .write(true)
        .open(PIPE)
        .map_err(|e| e.to_string())?;
    let r = f.try_clone().map_err(|e| e.to_string())?;
    Ok((f, BufReader::new(r)))
}

fn talk(slot: &mut Option<(File, BufReader<File>)>, req: &Value) -> Result<Value, String> {
    if slot.is_none() {
        *slot = Some(open_link()?);
    }
    let (w, r) = slot.as_mut().unwrap();
    let mut text = serde_json::to_string(req).map_err(|e| e.to_string())?;
    text.push('\n');
    w.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    w.flush().map_err(|e| e.to_string())?;
    let mut line = String::new();
    let n = r
        .by_ref()
        .take(4 * 1024 * 1024)
        .read_line(&mut line)
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("the helper closed the connection".into());
    }
    serde_json::from_str(&line).map_err(|e| e.to_string())
}

fn ask(link: &Link, req: &Value) -> Result<Value, String> {
    let mut g = link.0.lock().unwrap_or_else(|e| e.into_inner());
    match talk(&mut g, req) {
        Ok(v) => Ok(v),
        Err(_) => {
            *g = None; // the connection is stale (the service restarted): one fresh try
            talk(&mut g, req)
        }
    }
}

/// the name of the Windows account, for the profile
#[tauri::command]
fn user_name() -> String {
    std::env::var("USERNAME").unwrap_or_default()
}

// async, so that a slow answer from the helper never freezes the window
#[tauri::command]
async fn helper(link: State<'_, Link>, req: Value) -> Result<Value, String> {
    ask(&link, &req)
}

// ---------- the window's own small settings ----------

fn settings_path() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("EyeTime").join("app.json")
}
pub(crate) fn read_settings() -> Value {
    std::fs::read_to_string(settings_path())
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_else(|| json!({"launch": true, "tray": true}))
}
fn write_settings(v: &Value) {
    let p = settings_path();
    if let Some(d) = p.parent() {
        let _ = std::fs::create_dir_all(d);
    }
    let _ = std::fs::write(p, serde_json::to_string(v).unwrap_or_default());
}
fn tray_on() -> bool {
    read_settings()["tray"].as_bool().unwrap_or(true)
}

#[tauri::command]
fn apply_setting(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let on = value.trim() == "true";
    let mut s = read_settings();
    match key.as_str() {
        "launch" => {
            let al = app.autolaunch();
            let r = if on { al.enable() } else { al.disable() };
            r.map_err(|e| e.to_string())?;
            s["launch"] = json!(on);
        }
        "tray" => s["tray"] = json!(on),
        "notify" => s["notify"] = json!(on),
        "every" => s["every"] = json!(value.trim().parse::<u64>().unwrap_or(20).clamp(5, 120)),
        "bed" => s["bed"] = json!(value.trim()),
        "lang" => s["lang"] = json!(value.trim()),
        _ => return Ok(()),
    }
    write_settings(&s);
    Ok(())
}

#[tauri::command]
fn window_ctl(app: AppHandle, action: String) {
    if let Some(w) = app.get_webview_window("main") {
        match action.as_str() {
            "minimize" => {
                let _ = w.minimize();
            }
            "toggle_maximize" => {
                if w.is_maximized().unwrap_or(false) {
                    let _ = w.unmaximize();
                } else {
                    let _ = w.maximize();
                }
            }
            "close" => {
                let _ = w.close();
            }
            _ => {}
        }
    }
}

/// open the browser extension's folder, or a browser's extensions page (the person turns on Developer mode and loads the folder once)
#[tauri::command]
fn open_target(kind: String) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("no folder")?.to_path_buf();
    let mut c = match kind.as_str() {
        "extension_folder" => {
            let mut c = std::process::Command::new(eyetime_core::sys::windows_dir("explorer"));
            c.arg(dir.join("extension"));
            c
        }
        "chrome_extensions" => {
            let mut c = std::process::Command::new(eyetime_core::sys::system32("cmd"));
            c.args(["/c", "start", "", "chrome", "chrome://extensions"]);
            c
        }
        "privacy" => {
            let mut c = std::process::Command::new(eyetime_core::sys::system32("cmd"));
            c.args([
                "/c",
                "start",
                "",
                "https://maxbzd.github.io/eyetime/privacy.html",
            ]);
            c
        }
        "feedback" => {
            let mut c = std::process::Command::new(eyetime_core::sys::system32("cmd"));
            c.args([
                "/c",
                "start",
                "",
                "https://github.com/maxbzd/eyetime/issues/new/choose",
            ]);
            c
        }
        "edge_extensions" => {
            let mut c = std::process::Command::new(eyetime_core::sys::system32("cmd"));
            c.args(["/c", "start", "", "msedge", "edge://extensions"]);
            c
        }
        _ => return Ok(()),
    };
    c.creation_flags(0x0800_0000)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// what the helper has, as lines of script that run before the page does, so that the screens start with the real setup
fn boot_script(link: &Link) -> String {
    let mut js = String::from("try{");
    if let Ok(r) = ask(link, &json!({"op": "get_state"})) {
        if r["ok"].as_bool().unwrap_or(false) {
            if let Some(map) = r["data"].as_object() {
                for k in KEYS {
                    if let Some(v) = map.get(k) {
                        // double-encoded so that it is a JS string literal of the JSON text
                        let text = serde_json::to_string(&v.to_string()).unwrap_or_default();
                        js.push_str(&format!("localStorage.setItem('{k}',{text});"));
                    }
                }
            }
        }
    }
    js.push_str("}catch(e){}");
    js
}

fn main() {
    let hidden = std::env::args().any(|a| a == "--hidden");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .manage(Link(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![helper, apply_setting, window_ctl, open_target, user_name])
        .setup(move |app| {
            nudge::start();
            let link = app.state::<Link>();
            let script = boot_script(&link);
            // for the automatic checks only: EYETIME_DEBUG_PORT=9222 opens the window's debugging port so that a script can click through it
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("home.html".into()));
            if let Some(port) = std::env::var("EYETIME_DEBUG_PORT").ok().and_then(|p| p.parse::<u16>().ok()) {
                builder = builder.additional_browser_args(&format!("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port={port} --remote-allow-origins=*"));
            }
            let win = builder
                .title("EyeTime")
                .inner_size(1280.0, 820.0)
                .min_inner_size(1020.0, 680.0)
                .decorations(false)
                .shadow(true)
                .center()
                .visible(!hidden)
                .initialization_script(&script)
                .build()?;
            // a first run starts with the sensible defaults: start with Windows, live in the tray
            if !settings_path().exists() {
                write_settings(&json!({"launch": true, "tray": true}));
                let _ = app.autolaunch().enable();
            }
            let w2 = win.clone();
            win.on_window_event(move |ev| {
                if let WindowEvent::CloseRequested { api, .. } = ev {
                    if tray_on() {
                        api.prevent_close();
                        let _ = w2.hide();
                    }
                }
            });
            let open = MenuItem::with_id(app, "open", "Open EyeTime", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit the window (blocks keep running)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("EyeTime")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("EyeTime failed to start");
}
