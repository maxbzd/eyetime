// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! eyetime-setup.exe: the installer and, with --uninstall, the uninstaller. One window, one animation, a few honest steps.
//! It needs administrator rights (it installs a Windows service) and asks for them once, when it starts.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod payload {
    include!(concat!(env!("OUT_DIR"), "/payload.rs"));
}
mod steps;

use serde_json::{json, Value};
use std::borrow::Cow;
use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tao::window::WindowBuilder;
use wry::http::{header::CONTENT_TYPE, Response};
use wry::WebViewBuilder;

// wry serves a custom protocol as http://<name>.localhost on Windows
#[cfg(windows)]
const START_URL: &str = "http://app.localhost/";
#[cfg(not(windows))]
const START_URL: &str = "app://localhost/";

#[derive(Debug)]
enum Ui {
    Js(String),
    Cmd(Value),
}

fn asset(path: &str) -> Option<(&'static str, &'static [u8])> {
    Some(match path {
        "/" | "/index.html" => (
            "text/html; charset=utf-8",
            include_bytes!("../ui/index.html"),
        ),
        "/fonts.css" => ("text/css", include_bytes!("../ui/fonts.css")),
        "/cave.jpg" => ("image/jpeg", include_bytes!("../ui/cave.jpg")),
        "/gem-sprite.webp" => ("image/webp", include_bytes!("../ui/gem-sprite.webp")),
        "/fonts/figtree-v9-_Xms-HUzqDCFdgfMm4S9DQ.woff2" => (
            "font/woff2",
            include_bytes!("../ui/fonts/figtree-v9-_Xms-HUzqDCFdgfMm4S9DQ.woff2"),
        ),
        "/fonts/figtree-v9-_Xms-HUzqDCFdgfMm4q9DbZs.woff2" => (
            "font/woff2",
            include_bytes!("../ui/fonts/figtree-v9-_Xms-HUzqDCFdgfMm4q9DbZs.woff2"),
        ),
        "/fonts/outfit-v15-QGYvz_MVcBeNP4NJtEtq.woff2" => (
            "font/woff2",
            include_bytes!("../ui/fonts/outfit-v15-QGYvz_MVcBeNP4NJtEtq.woff2"),
        ),
        "/fonts/outfit-v15-QGYvz_MVcBeNP4NJuktqQ4E.woff2" => (
            "font/woff2",
            include_bytes!("../ui/fonts/outfit-v15-QGYvz_MVcBeNP4NJuktqQ4E.woff2"),
        ),
        _ => return None,
    })
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let uninstall = args.iter().any(|a| a == "--uninstall");
    if !steps::is_admin() {
        steps::relaunch_elevated(&args[1..]);
        return;
    }

    // no window: for scripts and for the automatic checks (--silent [--log <file>]). Exit code 0 means it worked.
    if args.iter().any(|a| a == "--silent") {
        let log = args
            .iter()
            .position(|a| a == "--log")
            .and_then(|i| args.get(i + 1))
            .cloned();
        let failed = std::sync::atomic::AtomicBool::new(false);
        let emit = |m: String| {
            if m.contains("\"type\":\"error\"") || m.contains("\"type\":\"blocked\"") {
                failed.store(true, std::sync::atomic::Ordering::Relaxed);
            }
            if let Some(path) = &log {
                use std::io::Write;
                if let Ok(mut f) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(path)
                {
                    let _ = writeln!(f, "{m}");
                }
            }
        };
        if uninstall {
            steps::uninstall(false, &emit);
            if !failed.load(std::sync::atomic::Ordering::Relaxed) {
                steps::remove_self_later();
            }
        } else {
            // an update keeps the choice about the desktop icon that was made at the first install
            let desktop = !args.iter().any(|a| a == "--update") || steps::desktop_icon_exists();
            steps::install(desktop, &emit);
        }
        std::process::exit(if failed.load(std::sync::atomic::Ordering::Relaxed) {
            1
        } else {
            0
        });
    }

    let event_loop = EventLoopBuilder::<Ui>::with_user_event().build();
    let proxy = event_loop.create_proxy();
    let window = WindowBuilder::new()
        .with_title("EyeTime Setup")
        .with_inner_size(LogicalSize::new(760.0, 520.0))
        .with_resizable(false)
        .with_decorations(false)
        .with_transparent(true)
        .build(&event_loop)
        .expect("window");

    let ipc_proxy = proxy.clone();
    // The window keeps its browser data in a folder of its own in the temporary files, never next to this program: the uninstaller runs from
    // C:\Program Files, where the browser engine is not given a place to write, and the folder would also stay behind after the uninstall.
    let mut web_context = wry::WebContext::new(Some(steps::webview_dir()));
    let webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_transparent(true)
        .with_url(START_URL)
        .with_custom_protocol("app".into(), |_id, req| {
            let path = req.uri().path().to_string();
            match asset(&path) {
                Some((ct, bytes)) => Response::builder()
                    .header(CONTENT_TYPE, ct)
                    .body(Cow::Borrowed(bytes))
                    .unwrap(),
                None => Response::builder()
                    .status(404)
                    .body(Cow::Borrowed(&b"not found"[..]))
                    .unwrap(),
            }
        })
        .with_ipc_handler(move |req| {
            if let Ok(v) = serde_json::from_str::<Value>(req.body()) {
                let _ = ipc_proxy.send_event(Ui::Cmd(v));
            }
        })
        .build(&window)
        .expect("webview");

    let mut finished_uninstall = false;
    let existing = steps::service_exists();
    event_loop.run(move |event, _, flow| {
        let _keep = &web_context; // lives as long as the window
        *flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(Ui::Js(code)) => {
                let _ = webview.evaluate_script(&code);
            }
            Event::UserEvent(Ui::Cmd(c)) => match c["cmd"].as_str().unwrap_or("") {
                "ready" => {
                    let _ = webview.evaluate_script(&format!("window.__ev({})", json!({"type": "init", "mode": if uninstall { "uninstall" } else { "install" }, "existing": existing})));
                }
                "drag" => {
                    let _ = window.drag_window();
                }
                "install" => {
                    let desktop = c["opts"]["desktop"].as_bool().unwrap_or(true);
                    let p = proxy.clone();
                    std::thread::spawn(move || steps::install(desktop, &|m| {
                        let _ = p.send_event(Ui::Js(format!("window.__ev({m})")));
                    }));
                }
                "uninstall" => {
                    finished_uninstall = true;
                    let delete = c["opts"]["deleteData"].as_bool().unwrap_or(false);
                    let p = proxy.clone();
                    std::thread::spawn(move || steps::uninstall(delete, &|m| {
                        let _ = p.send_event(Ui::Js(format!("window.__ev({m})")));
                    }));
                }
                "open_app" => {
                    steps::open_app();
                    steps::forget_webview_dir();
                    *flow = ControlFlow::Exit;
                }
                "close" => {
                    if uninstall && finished_uninstall {
                        steps::remove_self_later();
                    }
                    steps::forget_webview_dir();
                    *flow = ControlFlow::Exit;
                }
                _ => {}
            },
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                steps::forget_webview_dir();
                *flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}
