// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! eyetime-sim: the helper's brain on a pretend computer, behind a tiny web server, so that the screens can be tried
//! (with a browser, on any machine) against the real logic. Not part of the product.
//!   eyetime-sim <folder with the screens> [port]
//!   POST /req   one request to the helper (JSON in, JSON out)
//!   POST /sim   {"procs":[["steam.exe",10]], "fg":"steam.exe", "windows":[...], "idle":0, "jump":3600}
//!   GET  /world what the pretend computer looks like now

use eyetime_core::ipc::{parse_request, Fg, Request, Win};
use eyetime_helper::os::Proc;
use eyetime_helper::sim::{Fake, World};
use eyetime_helper::supervisor::Supervisor;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};

struct Scene {
    fg: Option<String>,
    windows: Vec<(String, u32)>,
    idle: u32,
}

fn main() {
    let dir = std::env::args().nth(1).unwrap_or_else(|| ".".into());
    let port: u16 = std::env::args()
        .nth(2)
        .and_then(|p| p.parse().ok())
        .unwrap_or(8131);
    let world = Arc::new(Mutex::new(World {
        wall: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(1_793_786_400_000),
        mono: 1_000_000,
        hosts: "127.0.0.1 localhost\r\n".into(),
        hosts_writable: true,
        ..Default::default()
    }));
    let fake = Fake(world.clone());
    let sup = Arc::new(Mutex::new(Supervisor::new(fake.clone())));
    let scene = Arc::new(Mutex::new(Scene {
        fg: None,
        windows: vec![],
        idle: 0,
    }));

    {
        let (sup, world, scene) = (sup.clone(), world.clone(), scene.clone());
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_millis(100));
            {
                let mut w = world.lock().unwrap();
                w.wall += 2000;
                w.mono += 2000;
            }
            let mut s = sup.lock().unwrap();
            let sc = scene.lock().unwrap();
            let fg = sc.fg.as_ref().map(|e| Fg {
                exe: e.clone(),
                title: "x".into(),
                pid: 1,
            });
            let windows = sc
                .windows
                .iter()
                .map(|(e, p)| Win {
                    exe: e.clone(),
                    title: "t".into(),
                    pid: *p,
                })
                .collect();
            s.handle(Request::Observe {
                fg,
                idle_secs: sc.idle,
                windows,
                screen_locked: false,
            });
            s.tick();
        });
    }

    let listener = TcpListener::bind(("127.0.0.1", port)).expect("port");
    eprintln!("eyetime-sim on http://127.0.0.1:{port}/home.html");
    for conn in listener.incoming().flatten() {
        let (sup, world, scene, dir) = (sup.clone(), world.clone(), scene.clone(), dir.clone());
        std::thread::spawn(move || {
            let _ = serve(conn, &sup, &world, &scene, &dir);
        });
    }
}

fn serve(
    mut conn: TcpStream,
    sup: &Arc<Mutex<Supervisor<Fake>>>,
    world: &Arc<Mutex<World>>,
    scene: &Arc<Mutex<Scene>>,
    dir: &str,
) -> std::io::Result<()> {
    let mut r = BufReader::new(conn.try_clone()?);
    let mut first = String::new();
    r.read_line(&mut first)?;
    let mut len = 0usize;
    loop {
        let mut h = String::new();
        r.read_line(&mut h)?;
        if h.trim().is_empty() {
            break;
        }
        if let Some(v) = h.to_lowercase().strip_prefix("content-length:") {
            len = v.trim().parse().unwrap_or(0);
        }
    }
    let mut body = vec![0u8; len];
    r.read_exact(&mut body)?;
    let body = String::from_utf8_lossy(&body).to_string();
    let mut parts = first.split_whitespace();
    let (method, path) = (parts.next().unwrap_or(""), parts.next().unwrap_or("/"));
    let (code, ctype, out): (u16, &str, Vec<u8>) = match (method, path) {
        ("POST", "/req") => match parse_request(&body) {
            Ok(req) => (
                200,
                "application/json",
                serde_json::to_vec(&sup.lock().unwrap().handle(req)).unwrap(),
            ),
            Err(e) => (
                200,
                "application/json",
                serde_json::to_vec(
                    &json!({"ok": false, "code": "bad_request", "message": e, "data": null}),
                )
                .unwrap(),
            ),
        },
        ("POST", "/sim") => {
            let v: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
            let mono = world.lock().unwrap().mono;
            // the update, as the screens should see it: {"update":{"phase":"downloading","pct":40,"version":"0.2.0","notes":[..],"size":6500000,"error":"","ago":60000}}
            if let Some(u) = v.get("update") {
                let sup = sup.lock().unwrap();
                let mut s = sup.upd.lock().unwrap();
                use eyetime_helper::update::Phase;
                if let Some(p) = u["phase"].as_str() {
                    s.phase = match p {
                        "checking" => Phase::Checking,
                        "available" => Phase::Available,
                        "downloading" => Phase::Downloading,
                        "ready" => Phase::Ready,
                        "installing" => Phase::Installing,
                        "error" => Phase::Error,
                        _ => Phase::Idle,
                    };
                }
                if matches!(s.phase, Phase::Ready | Phase::Installing) {
                    s.path = Some(std::path::PathBuf::from(
                        "C:/ProgramData/EyeTime/update/EyeTime-Setup.exe",
                    ));
                }
                if let Some(p) = u["pct"].as_u64() {
                    s.pct = p as u32;
                }
                if let Some(e) = u["error"].as_str() {
                    s.error = e.into();
                }
                if let Some(a) = u["ago"].as_i64() {
                    s.checked_ms = mono - a;
                }
                if let Some(ver) = u["version"].as_str() {
                    s.info = Some(eyetime_core::update::UpdateInfo {
                        version: ver.into(),
                        notes: u["notes"]
                            .as_array()
                            .map(|n| {
                                n.iter()
                                    .filter_map(|x| x.as_str().map(String::from))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        url: "x".into(),
                        sha256: "0".repeat(64),
                        size: u["size"].as_u64().unwrap_or(0),
                        sig_url: String::new(),
                    });
                } else if u["none"].as_bool().unwrap_or(false) {
                    s.info = None;
                }
                if let Some(wl) = u["want_install"].as_bool() {
                    s.want_install = wl;
                }
            }
            if let Some(u) = v.get("updated") {
                let mut sup = sup.lock().unwrap();
                sup.p.updated = serde_json::from_value(u.clone()).ok();
            }
            {
                let mut w = world.lock().unwrap();
                if let Some(ps) = v["procs"].as_array() {
                    w.procs = ps
                        .iter()
                        .map(|p| Proc {
                            exe: p[0].as_str().unwrap_or("").into(),
                            pid: p[1].as_u64().unwrap_or(0) as u32,
                        })
                        .collect();
                    w.killed.clear();
                }
                if let Some(j) = v["jump"].as_i64() {
                    w.wall += j * 1000;
                }
                if let Some(h) = v["hosts"].as_str() {
                    w.hosts = h.into();
                }
            }
            let mut sc = scene.lock().unwrap();
            if v.get("fg").is_some() {
                sc.fg = v["fg"].as_str().map(|s| s.to_string());
            }
            if let Some(ws) = v["windows"].as_array() {
                sc.windows = ws
                    .iter()
                    .map(|p| {
                        (
                            p[0].as_str().unwrap_or("").into(),
                            p[1].as_u64().unwrap_or(0) as u32,
                        )
                    })
                    .collect();
            }
            if let Some(i) = v["idle"].as_u64() {
                sc.idle = i as u32;
            }
            (200, "application/json", b"{}".to_vec())
        }
        ("GET", "/world") => {
            let w = world.lock().unwrap();
            (200, "application/json", serde_json::to_vec(&json!({"hosts": w.hosts, "killed": w.killed, "taskmgr": w.taskmgr, "awake": w.awake, "doh": w.doh, "safeboot": w.safeboot, "launched": w.launched.len()})).unwrap())
        }
        ("GET", p) => {
            let rel = p.split('?').next().unwrap_or("/").trim_start_matches('/');
            let rel = if rel.is_empty() { "home.html" } else { rel };
            if rel.contains("..") {
                (403, "text/plain", b"no".to_vec())
            } else {
                match std::fs::read(std::path::Path::new(dir).join(rel)) {
                    Ok(b) => {
                        let ct = match rel.rsplit('.').next().unwrap_or("") {
                            "html" => "text/html; charset=utf-8",
                            "js" => "text/javascript; charset=utf-8",
                            "css" => "text/css; charset=utf-8",
                            "jpg" => "image/jpeg",
                            "png" => "image/png",
                            "woff2" => "font/woff2",
                            _ => "application/octet-stream",
                        };
                        (200, ct, b)
                    }
                    Err(_) => (404, "text/plain", b"not found".to_vec()),
                }
            }
        }
        _ => (404, "text/plain", b"no".to_vec()),
    };
    write!(
        conn,
        "HTTP/1.1 {code} X\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        out.len()
    )?;
    conn.write_all(&out)
}
