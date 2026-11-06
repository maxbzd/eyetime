// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! The supervisor against a pretend computer.

use crate::os::Proc;
use crate::supervisor::Supervisor;
use eyetime_core::friction::Pin;
use eyetime_core::hosts;
use eyetime_core::ipc::{Fg, Request, Response, Status, Win};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::sim::{Fake, World};

// Wednesday 2026-11-04 10:00 UTC
const T0: i64 = 1_793_786_400_000;

fn world() -> (Fake, Supervisor<Fake>) {
    let w = Arc::new(Mutex::new(World {
        wall: T0,
        mono: 1_000_000,
        hosts: "127.0.0.1 localhost\r\n".into(),
        hosts_writable: true,
        ..Default::default()
    }));
    let f = Fake(w);
    let s = Supervisor::new(f.clone());
    (f, s)
}

fn advance(f: &Fake, s: &mut Supervisor<Fake>, secs: i64) {
    for _ in 0..secs / 2 {
        {
            let mut w = f.0.lock().unwrap();
            w.wall += 2000;
            w.mono += 2000;
        }
        s.tick();
    }
}

fn set(s: &mut Supervisor<Fake>, keys: Value) -> Response {
    s.handle(Request::SetState {
        keys: serde_json::from_value::<HashMap<String, Value>>(keys).unwrap(),
        pin: None,
    })
}

fn setup(s: &mut Supervisor<Fake>) {
    let r = set(
        s,
        json!({
            "et-items": [
                {"name":"YouTube","type":"site","g":"dis"},
                {"name":"Steam","type":"app","g":"dis"},
                {"name":"docs.google.com","type":"site","g":"allow"}
            ],
            "et-protect": {"friction":"type","emerg":3,"emergWeek":1}
        }),
    );
    assert!(r.ok, "{r:?}");
}

fn start(s: &mut Supervisor<Fake>, minutes: u32, level: u8) -> Response {
    s.handle(Request::StartSession {
        name: "Deep work".into(),
        minutes,
        level,
        blocks: vec![],
        scene: "".into(),
        allow_breaks: true,
        dnd: false,
        mute: false,
        close_now: false,
    })
}

fn status(s: &mut Supervisor<Fake>) -> Status {
    serde_json::from_value(s.handle(Request::Status).data).unwrap()
}

fn proc(pid: u32, exe: &str) -> Proc {
    Proc {
        pid,
        exe: exe.into(),
    }
}

#[test]
fn a_session_closes_sites_and_programs_and_ends_by_itself() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().procs = vec![
        proc(10, "steam.exe"),
        proc(11, "notepad.exe"),
        proc(12, "explorer.exe"),
    ];
    advance(&f, &mut s, 4);
    assert!(
        f.0.lock().unwrap().killed.is_empty(),
        "nothing is closed before a session"
    );
    assert!(start(&mut s, 25, 1).ok);
    advance(&f, &mut s, 4);
    assert!(
        f.0.lock().unwrap().killed.is_empty(),
        "first it is asked to close, so that it can offer to save"
    );
    let asked = s.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    });
    assert_eq!(asked.data["closePids"], json!([10]));
    advance(&f, &mut s, 16);
    let w = f.0.lock().unwrap();
    assert_eq!(w.killed, vec![10]);
    assert!(w.hosts.contains("0.0.0.0 youtube.com"));
    assert!(w.hosts.starts_with("127.0.0.1 localhost"));
    drop(w);
    advance(&f, &mut s, 25 * 60);
    let w = f.0.lock().unwrap();
    assert!(
        !w.hosts.contains(hosts::BEGIN),
        "the hosts file is clean again"
    );
    drop(w);
    assert!(status(&mut s).session.is_none());
    assert_eq!(status(&mut s).streak_days, 1);
    assert_eq!(*status(&mut s).focus_minutes.last().unwrap(), 25);
    let t = status(&mut s).totals;
    assert_eq!(
        (t.focus_min, t.sessions, t.best_streak),
        (25, 1, 1),
        "what was done is counted for the profile"
    );
    assert!(!t.since_day.is_empty());
}

#[test]
fn someone_editing_the_hosts_file_is_undone() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 30, 2);
    advance(&f, &mut s, 4);
    f.0.lock().unwrap().hosts = "127.0.0.1 localhost\r\n".into();
    advance(&f, &mut s, 2);
    assert!(f.0.lock().unwrap().hosts.contains("youtube.com"));
    assert!(status(&mut s).events.iter().any(|e| e.name == "hosts"));
}

#[test]
fn a_locked_session_cannot_be_ended_or_loosened_but_an_emergency_key_opens_it() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 60, 2);
    advance(&f, &mut s, 4);
    // no way out by asking
    assert_eq!(
        s.handle(Request::Challenge {
            action: "end_session".into(),
            target: None,
            minutes: None
        })
        .code,
        "locked"
    );
    assert_eq!(
        s.handle(Request::Challenge {
            action: "break".into(),
            target: None,
            minutes: Some(5)
        })
        .code,
        "locked"
    );
    // no way out by editing
    let r = set(&mut s, json!({"et-items": []}));
    assert_eq!(r.code, "locked");
    let r = set(
        &mut s,
        json!({"et-protect": {"friction":"none","emerg":3,"emergWeek":1}}),
    );
    assert_eq!(r.code, "locked");
    // adding more to the list is fine
    assert!(set(&mut s, json!({"et-kw": ["casino"]})).ok);
    assert!(status(&mut s).decision.locked());

    // the emergency key: a challenge, the right answer after the pause
    let c = s.handle(Request::Challenge {
        action: "emergency".into(),
        target: None,
        minutes: None,
    });
    assert!(c.ok, "{c:?}");
    let id = c.data["id"].as_str().unwrap().to_string();
    assert!(c.data.get("answer").is_none());
    let early = s.handle(Request::Complete {
        challenge_id: id.clone(),
        answer: "x".into(),
        pin: None,
        partner_code: None,
    });
    assert_eq!(early.code, "early");
    advance(&f, &mut s, 4);
    let wrong = s.handle(Request::Complete {
        challenge_id: id,
        answer: "x".into(),
        pin: None,
        partner_code: None,
    });
    assert_eq!(wrong.code, "wrong");
}

fn answer_for(s: &mut Supervisor<Fake>, action: &str, target: Option<&str>) -> (String, String) {
    // the test peeks at the pending challenge the way a person reads the text on the screen
    let c = s.handle(Request::Challenge {
        action: action.into(),
        target: target.map(|t| t.into()),
        minutes: Some(5),
    });
    assert!(c.ok, "{c:?}");
    (
        c.data["id"].as_str().unwrap().to_string(),
        c.data["prompt"].as_str().unwrap().to_string(),
    )
}

#[test]
fn typing_the_text_ends_a_soft_session_and_the_streak_resets() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 60, 1);
    advance(&f, &mut s, 4);
    let (id, text) = answer_for(&mut s, "end_session", None);
    advance(&f, &mut s, 4);
    let r = s.handle(Request::Complete {
        challenge_id: id,
        answer: text,
        pin: None,
        partner_code: None,
    });
    assert!(r.ok, "{r:?}");
    assert!(status(&mut s).session.is_none());
    advance(&f, &mut s, 2);
    assert!(!f.0.lock().unwrap().hosts.contains(hosts::BEGIN));
}

#[test]
fn emergency_key_with_the_right_text_releases_even_a_frozen_session_and_is_counted() {
    let (f, mut s) = world();
    setup(&mut s);
    assert!(start(&mut s, 120, 3).ok);
    f.0.lock().unwrap().procs = vec![proc(20, "taskmgr.exe"), proc(21, "notepad.exe")];
    advance(&f, &mut s, 4);
    {
        let w = f.0.lock().unwrap();
        assert!(
            w.taskmgr && w.killed.contains(&20),
            "frozen: task manager locked and closed (tools are not asked)"
        );
    }
    // allow-only needs a sight of the screen to know what is open
    s.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![Win {
            exe: "notepad.exe".into(),
            title: "".into(),
            pid: 21,
        }],
        screen_locked: false,
    });
    advance(&f, &mut s, 12);
    s.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![Win {
            exe: "notepad.exe".into(),
            title: "".into(),
            pid: 21,
        }],
        screen_locked: false,
    });
    advance(&f, &mut s, 2);
    assert!(f.0.lock().unwrap().killed.contains(&21));
    let (id, text) = answer_for(&mut s, "emergency", None);
    advance(&f, &mut s, 4);
    let r = s.handle(Request::Complete {
        challenge_id: id,
        answer: text,
        pin: None,
        partner_code: None,
    });
    assert!(r.ok, "{r:?}");
    advance(&f, &mut s, 2);
    let st = status(&mut s);
    assert!(st.session.is_none() && !st.decision.active());
    assert_eq!(st.emergency_total, 1);
    assert_eq!(st.emergency_left, 0); // one a week
    assert!(!f.0.lock().unwrap().taskmgr);
    // a second one in the same week is refused
    start(&mut s, 60, 2);
    assert_eq!(
        s.handle(Request::Challenge {
            action: "emergency".into(),
            target: None,
            minutes: None
        })
        .code,
        "no_keys"
    );
}

#[test]
fn frozen_sessions_have_a_ceiling() {
    let (_f, mut s) = world();
    assert_eq!(start(&mut s, 9 * 60, 3).code, "bad_request");
    assert!(start(&mut s, 8 * 60, 3).ok);
}

#[test]
fn the_clock_cannot_be_used_to_skip_a_locked_session() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 60, 2);
    advance(&f, &mut s, 10);
    f.0.lock().unwrap().wall += 3 * 3_600_000; // forward three hours
    advance(&f, &mut s, 2);
    let st = status(&mut s);
    assert!(st.session.is_some() && st.decision.locked(), "still locked");
    assert!(st.clock_tampered);
    f.0.lock().unwrap().wall -= 6 * 3_600_000; // and back
    advance(&f, &mut s, 2);
    assert!(status(&mut s).session.is_some());
}

#[test]
fn a_restart_keeps_the_session_and_cannot_roll_the_clock_back() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 60, 2);
    advance(&f, &mut s, 600);
    s.shutdown(true);
    let store = f.0.lock().unwrap().store.clone();
    // the computer starts again: the monotonic clock starts over, and the person set the wall clock back two hours
    let w = Arc::new(Mutex::new(World {
        wall: T0 - 2 * 3_600_000,
        mono: 5_000,
        hosts: f.0.lock().unwrap().hosts.clone(),
        hosts_writable: true,
        store,
        ..Default::default()
    }));
    let f2 = Fake(w);
    let mut s2 = Supervisor::new(f2.clone());
    advance(&f2, &mut s2, 4);
    let st = status(&mut s2);
    assert!(st.session.is_some(), "the session survived the restart");
    assert!(st.decision.locked());
    // it ends when it should by the trusted time (about 50 more minutes), not two hours later
    advance(&f2, &mut s2, 49 * 60);
    assert!(status(&mut s2).session.is_some());
    advance(&f2, &mut s2, 3 * 60);
    assert!(status(&mut s2).session.is_none());
}

#[test]
fn the_pin_guards_loosening_and_locks_out_guessing() {
    let (f, mut s) = world();
    setup(&mut s);
    assert!(
        s.handle(Request::SetPin {
            old: None,
            new: "4821".into()
        })
        .ok
    );
    assert!(
        set(
            &mut s,
            json!({"et-protect": {"friction":"type","emerg":3,"emergWeek":1,"pinOn":true}})
        )
        .ok
    );
    assert_eq!(
        s.handle(Request::SetPin {
            old: Some("0000".into()),
            new: "1111".into()
        })
        .code,
        "pin"
    );
    // loosening now needs the PIN
    let weaker = json!({"et-items": []});
    assert_eq!(set(&mut s, weaker.clone()).code, "pin");
    let r = s.handle(Request::SetState {
        keys: serde_json::from_value(weaker).unwrap(),
        pin: Some("4821".into()),
    });
    assert!(r.ok, "{r:?}");
    for _ in 0..2 {
        s.handle(Request::SetPin {
            old: Some("1".into()),
            new: "2222".into(),
        });
    }
    advance(&f, &mut s, 2);
    assert_eq!(
        s.handle(Request::SetPin {
            old: Some("9999".into()),
            new: "2222".into()
        })
        .code,
        "pin"
    );
    assert_eq!(
        s.handle(Request::SetPin {
            old: Some("4821".into()),
            new: "2222".into()
        })
        .code,
        "pin_locked"
    );
    let _ = Pin::default();
}

#[test]
fn what_is_in_front_is_counted_and_a_daily_limit_closes_it() {
    let (f, mut s) = world();
    setup(&mut s);
    set(
        &mut s,
        json!({"et-limits": [{"id":"l1","name":"Steam","scope":"app","kind":"time","amount":2,"per":"day","on":true,"act":"block"}]}),
    );
    f.0.lock().unwrap().procs = vec![proc(30, "steam.exe")];
    let obs = Request::Observe {
        fg: Some(Fg {
            exe: "Steam.exe".into(),
            title: "Steam".into(),
            pid: 30,
        }),
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    };
    for _ in 0..100 {
        s.handle(obs.clone());
        advance(&f, &mut s, 2);
        if !f.0.lock().unwrap().killed.is_empty() {
            break;
        }
    }
    let st = status(&mut s);
    assert!(st.today.secs["exe:steam.exe"] >= 120);
    assert!(f.0.lock().unwrap().killed.contains(&30));
    assert_eq!(st.decision.reasons[0].kind, "limit");
    // a break lifts it for a while
    let (id, text) = answer_for(&mut s, "unblock", Some("l1"));
    advance(&f, &mut s, 4);
    assert!(
        s.handle(Request::Complete {
            challenge_id: id,
            answer: text,
            pin: None,
            partner_code: None
        })
        .ok
    );
    assert!(!status(&mut s).decision.active());
}

#[test]
fn being_away_is_not_screen_time() {
    let (f, mut s) = world();
    setup(&mut s);
    let away = Request::Observe {
        fg: Some(Fg {
            exe: "steam.exe".into(),
            title: "".into(),
            pid: 30,
        }),
        idle_secs: 600,
        windows: vec![],
        screen_locked: false,
    };
    for _ in 0..10 {
        s.handle(away.clone());
        advance(&f, &mut s, 2);
    }
    let st = status(&mut s);
    assert!(st.today.secs.is_empty());
    assert!(st.today.offline_secs >= 18);
}

#[test]
fn allow_only_closes_open_windows_that_are_not_on_the_list() {
    let (f, mut s) = world();
    setup(&mut s);
    set(
        &mut s,
        json!({"et-items": [{"name":"VS Code","type":"app","g":"allow"}]}),
    );
    s.handle(Request::StartSession {
        name: "Only code".into(),
        minutes: 30,
        level: 1,
        blocks: vec!["Everything".into()],
        scene: "".into(),
        allow_breaks: false,
        dnd: false,
        mute: false,
        close_now: false,
    });
    f.0.lock().unwrap().procs = vec![
        proc(40, "code.exe"),
        proc(41, "game.exe"),
        proc(42, "svchost.exe"),
    ];
    s.handle(Request::Observe {
        fg: Some(Fg {
            exe: "code.exe".into(),
            title: "x".into(),
            pid: 40,
        }),
        idle_secs: 0,
        windows: vec![
            Win {
                exe: "code.exe".into(),
                title: "".into(),
                pid: 40,
            },
            Win {
                exe: "game.exe".into(),
                title: "".into(),
                pid: 41,
            },
        ],
        screen_locked: false,
    });
    for _ in 0..12 {
        s.handle(Request::Observe {
            fg: Some(Fg {
                exe: "code.exe".into(),
                title: "x".into(),
                pid: 40,
            }),
            idle_secs: 0,
            windows: vec![
                Win {
                    exe: "code.exe".into(),
                    title: "".into(),
                    pid: 40,
                },
                Win {
                    exe: "game.exe".into(),
                    title: "".into(),
                    pid: 41,
                },
            ],
            screen_locked: false,
        });
        advance(&f, &mut s, 2);
    }
    assert_eq!(f.0.lock().unwrap().killed, vec![41]);
}

#[test]
fn vpn_tools_and_private_windows_follow_the_guards() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().procs = vec![proc(50, "NordVPN.exe")];
    start(&mut s, 30, 1);
    let r = s.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    });
    assert!(r.ok);
    assert_eq!(r.data["closePrivate"], true);
    advance(&f, &mut s, 20);
    assert!(f.0.lock().unwrap().killed.contains(&50));
}

#[test]
fn the_extension_is_told_what_is_closed() {
    let (f, mut s) = world();
    setup(&mut s);
    assert_eq!(
        s.handle(Request::Site {
            host: Some("youtube.com".into()),
            incognito: false,
            browser: "chrome".into()
        })
        .data["blocked"],
        false
    );
    start(&mut s, 30, 1);
    advance(&f, &mut s, 2);
    assert_eq!(
        s.handle(Request::Site {
            host: Some("www.youtube.com".into()),
            incognito: false,
            browser: "chrome".into()
        })
        .data["blocked"],
        true
    );
    assert_eq!(
        s.handle(Request::Site {
            host: Some("docs.google.com".into()),
            incognito: false,
            browser: "chrome".into()
        })
        .data["blocked"],
        false
    );
    assert!(status(&mut s).ext_connected);
}

#[test]
fn uninstalling_needs_permission_and_not_during_a_lock() {
    let (f, mut s) = world();
    setup(&mut s);
    assert_eq!(s.handle(Request::Uninstall).code, "challenge");
    let (id, text) = answer_for(&mut s, "uninstall", None);
    advance(&f, &mut s, 4);
    assert!(
        s.handle(Request::Complete {
            challenge_id: id,
            answer: text,
            pin: None,
            partner_code: None
        })
        .ok
    );
    assert!(s.handle(Request::Uninstall).ok);
    start(&mut s, 30, 2);
    advance(&f, &mut s, 2);
    assert_eq!(s.handle(Request::Uninstall).code, "locked");
}

#[test]
fn a_hosts_file_that_cannot_be_written_is_reported_not_fatal() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().hosts_writable = false;
    start(&mut s, 30, 1);
    advance(&f, &mut s, 2);
    assert!(!status(&mut s).hosts_ok);
}

#[test]
fn unknown_state_keys_are_ignored_and_the_state_survives_a_restart() {
    let (f, mut s) = world();
    assert!(set(&mut s, json!({"et-kw": ["poker"], "evil": 1})).ok);
    s.shutdown(true);
    let store = f.0.lock().unwrap().store.clone();
    assert!(!store.as_ref().unwrap().contains("evil"));
    let f2 = Fake(Arc::new(Mutex::new(World {
        wall: T0,
        mono: 1,
        store,
        hosts_writable: true,
        ..Default::default()
    })));
    let mut s2 = Supervisor::new(f2);
    assert_eq!(s2.handle(Request::GetState).data["et-kw"], json!(["poker"]));
}

#[test]
fn shutdown_without_keeping_blocks_cleans_up() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 30, 2);
    advance(&f, &mut s, 4);
    assert!(f.0.lock().unwrap().hosts.contains(hosts::BEGIN));
    s.shutdown(false);
    let w = f.0.lock().unwrap();
    assert!(!w.hosts.contains(hosts::BEGIN) && !w.taskmgr);
}

#[test]
fn normal_sessions_can_be_left_without_ceremony_and_resume_takes_back_breaks() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 30, 0);
    advance(&f, &mut s, 2);
    let c = s.handle(Request::Challenge {
        action: "end_session".into(),
        target: None,
        minutes: None,
    });
    assert_eq!(c.data["kind"], "none");
    let id = c.data["id"].as_str().unwrap().to_string();
    assert!(
        s.handle(Request::Complete {
            challenge_id: id,
            answer: "".into(),
            pin: None,
            partner_code: None
        })
        .ok
    );
    assert!(status(&mut s).session.is_none());

    // a break, then "block again"
    start(&mut s, 30, 1);
    let (id, text) = answer_for(&mut s, "break", None);
    advance(&f, &mut s, 4);
    assert!(
        s.handle(Request::Complete {
            challenge_id: id,
            answer: text,
            pin: None,
            partner_code: None
        })
        .ok
    );
    assert!(!status(&mut s).decision.active());
    assert!(s.handle(Request::Resume).ok);
    advance(&f, &mut s, 2);
    assert!(status(&mut s).decision.active());
}

#[test]
fn distracting_time_is_counted_apart() {
    let (f, mut s) = world();
    setup(&mut s);
    let fg = |exe: &str| Request::Observe {
        fg: Some(Fg {
            exe: exe.into(),
            title: "".into(),
            pid: 9,
        }),
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    };
    for _ in 0..10 {
        s.handle(fg("steam.exe"));
        advance(&f, &mut s, 2);
    }
    for _ in 0..5 {
        s.handle(fg("code.exe"));
        advance(&f, &mut s, 2);
    }
    let st = status(&mut s);
    assert!(st.today.dis_secs >= 18 && st.today.dis_secs < st.today.secs.values().sum::<u32>());
}

#[test]
fn a_setup_without_a_way_out_is_refused_by_the_helper() {
    let (f, mut s) = world();
    // no emergency keys at all: a locked session or rule would be a trap
    assert!(set(&mut s, json!({"et-protect": {"emerg": 0, "emergWeek": 0}})).ok);
    assert_eq!(start(&mut s, 30, 2).code, "no_escape");
    assert!(start(&mut s, 30, 1).ok, "a soft session is always fine");
    let r = set(
        &mut s,
        json!({"et-rules": [{"id":"r","name":"Always","level":2,"from":"00:00","to":"00:00","days":[0,1,2,3,4,5,6]}]}),
    );
    assert_eq!(r.code, "no_escape");
    // with a key it is allowed; a frozen rule has to be short
    assert!(set(&mut s, json!({"et-protect": {"emerg": 3, "emergWeek": 1}})).ok);
    assert!(set(&mut s, json!({"et-rules": [{"id":"r","name":"Always","level":2,"from":"00:00","to":"00:00","days":[0,1,2,3,4,5,6]}]})).ok);
    let r = set(
        &mut s,
        json!({"et-rules": [{"id":"r","name":"Always","level":3,"from":"00:00","to":"00:00","days":[0,1,2,3,4,5,6]}]}),
    );
    assert_eq!(r.code, "no_escape");
    let _ = f;
}

#[test]
fn a_program_that_closes_by_itself_is_left_alone() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().procs = vec![proc(10, "steam.exe")];
    start(&mut s, 30, 1);
    advance(&f, &mut s, 4);
    f.0.lock().unwrap().procs.clear(); // it saved and quit
    advance(&f, &mut s, 30);
    assert!(f.0.lock().unwrap().killed.is_empty());
}

// ---------------------------------------------------------------- updates

use crate::update::Phase;
use eyetime_core::update::UpdateInfo;

fn ready_update(s: &Supervisor<Fake>, wanted: bool, manual: bool) {
    let mut u = s.upd.lock().unwrap();
    u.phase = Phase::Ready;
    u.info = Some(UpdateInfo {
        version: "9.9.9".into(),
        notes: vec!["Faster".into()],
        url: "x".into(),
        sha256: "0".repeat(64),
        size: 5,
        sig_url: String::new(),
    });
    u.path = Some(std::path::PathBuf::from(
        "C:/ProgramData/EyeTime/update/EyeTime-Setup-0.2.0.exe",
    ));
    u.want_install = wanted;
    u.manual = manual;
}

#[test]
fn an_automatic_update_waits_for_a_quiet_moment_and_a_manual_one_does_not() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 30, 1);
    advance(&f, &mut s, 4);
    ready_update(&s, true, false);
    advance(&f, &mut s, 4);
    assert!(
        f.0.lock().unwrap().launched.is_empty(),
        "not in the middle of a session"
    );
    ready_update(&s, true, true);
    advance(&f, &mut s, 2);
    assert_eq!(
        f.0.lock().unwrap().launched.len(),
        1,
        "asked for by hand: now"
    );
    assert_eq!(s.upd.lock().unwrap().phase, Phase::Installing);
    // the service may be stopped by the installer, and keeps its blocks while it is
    assert!(s.may_stop() && s.stopping_for_update());
}

#[test]
fn a_locked_block_is_never_interrupted_by_an_update_and_the_update_waits() {
    let (f, mut s) = world();
    setup(&mut s);
    start(&mut s, 30, 2);
    advance(&f, &mut s, 4);
    ready_update(&s, true, true);
    advance(&f, &mut s, 6);
    assert!(f.0.lock().unwrap().launched.is_empty());
    let st = status(&mut s);
    assert!(st.update.waiting_for_lock);
    assert!(!s.stopping_for_update());
}

#[test]
fn when_nothing_is_running_an_update_that_is_ready_installs_by_itself_unless_it_is_turned_off() {
    let (f, mut s) = world();
    setup(&mut s);
    assert!(s.handle(Request::UpdateSetAuto { on: false }).ok);
    ready_update(&s, false, false);
    advance(&f, &mut s, 6);
    assert!(
        f.0.lock().unwrap().launched.is_empty(),
        "automatic updates are off: nothing happens without a click"
    );
    assert!(s.handle(Request::UpdateSetAuto { on: true }).ok);
    ready_update(&s, true, false);
    advance(&f, &mut s, 4);
    assert_eq!(f.0.lock().unwrap().launched.len(), 1);
}

#[test]
fn a_click_on_update_needs_something_to_update() {
    let (_f, mut s) = world();
    assert_eq!(s.handle(Request::UpdateInstall).code, "none");
    s.upd.lock().unwrap().phase = Phase::Available;
    assert!(s.handle(Request::UpdateInstall).ok);
    assert!(s.upd.lock().unwrap().want_install && s.upd.lock().unwrap().manual);
}

#[test]
fn after_the_update_the_window_is_reopened_once_and_told_what_is_new_until_it_has_shown_it() {
    let (f, mut s) = world();
    setup(&mut s);
    ready_update(&s, true, true);
    advance(&f, &mut s, 2);
    s.shutdown(true);
    let store = f.0.lock().unwrap().store.clone();
    // the new version starts (here the same code is "the new version": its number is the one that was announced)
    let mut p: crate::supervisor::Persist = serde_json::from_str(store.as_ref().unwrap()).unwrap();
    p.pending_update.as_mut().unwrap().to = crate::supervisor::VERSION.into();
    let f2 = Fake(Arc::new(Mutex::new(World {
        wall: T0 + 60_000,
        mono: 5000,
        store: Some(serde_json::to_string(&p).unwrap()),
        hosts_writable: true,
        ..Default::default()
    })));
    let mut s2 = Supervisor::new(f2.clone());
    let o = s2.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    });
    assert_eq!(o.data["launchApp"], true);
    assert_eq!(
        s2.p.uninstall_ok_until_ms, 0,
        "the permission to stop the service does not outlive the update"
    );
    let o = s2.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    });
    assert_eq!(o.data["launchApp"], false, "only once");
    assert_eq!(
        status(&mut s2).update.updated.as_ref().unwrap().to,
        crate::supervisor::VERSION
    );
    assert!(
        status(&mut s2).update.updated.is_some(),
        "stays until acknowledged"
    );
    s2.handle(Request::UpdateAck);
    assert!(status(&mut s2).update.updated.is_none());
}

#[test]
fn an_update_that_did_not_finish_is_reported_and_nothing_is_opened() {
    let (f, mut s) = world();
    setup(&mut s);
    ready_update(&s, true, true);
    advance(&f, &mut s, 2);
    s.shutdown(true);
    let store = f.0.lock().unwrap().store.clone(); // the announced version differs from the running one: it did not take
    let f2 = Fake(Arc::new(Mutex::new(World {
        wall: T0 + 60_000,
        mono: 5000,
        store,
        hosts_writable: true,
        ..Default::default()
    })));
    let mut s2 = Supervisor::new(f2);
    let o = s2.handle(Request::Observe {
        fg: None,
        idle_secs: 0,
        windows: vec![],
        screen_locked: false,
    });
    assert_eq!(o.data["launchApp"], false);
    assert!(status(&mut s2).update.error.contains("did not finish"));
}

#[test]
fn an_automatic_update_brings_the_window_back_only_if_it_was_open() {
    for (open, expect) in [(false, false), (true, true)] {
        let (f, mut s) = world();
        setup(&mut s);
        if open {
            s.handle(Request::Observe {
                fg: None,
                idle_secs: 0,
                windows: vec![eyetime_core::ipc::Win {
                    exe: "eyetime.exe".into(),
                    title: "EyeTime".into(),
                    pid: 7,
                }],
                screen_locked: false,
            });
        }
        ready_update(&s, true, false);
        advance(&f, &mut s, 4);
        assert_eq!(f.0.lock().unwrap().launched.len(), 1);
        assert_eq!(s.p.relaunch_app, expect);
    }
}

#[test]
fn an_installer_that_never_finished_is_given_up_on_and_can_be_tried_again() {
    let (f, mut s) = world();
    setup(&mut s);
    ready_update(&s, true, true);
    advance(&f, &mut s, 2);
    assert!(s.stopping_for_update());
    advance(&f, &mut s, 11 * 60);
    assert!(!s.stopping_for_update());
    let st = status(&mut s);
    assert!(st.update.error.contains("did not finish"));
    assert_eq!(st.update.state, "available");
    assert!(
        !s.may_stop() || !s.state.protect.tam.watchdog,
        "the permission to stop is gone"
    );
}

#[test]
fn an_automation_starts_a_normal_session_when_its_program_comes_to_the_front() {
    let (f, mut s) = world();
    setup(&mut s);
    assert!(set(&mut s, json!({"et-auto": [{"id":"a1","when":"app","wv":"VS Code","then":"start","tv":"Deep work, 50 min","on":true}, {"id":"a2","when":"wifi","wv":"Office","then":"rule","tv":"Work","on":true}]})).ok);
    let look = |s: &mut Supervisor<Fake>, exe: &str| {
        s.handle(Request::Observe {
            fg: Some(Fg {
                exe: exe.into(),
                title: "x".into(),
                pid: 5,
            }),
            idle_secs: 0,
            windows: vec![],
            screen_locked: false,
        });
    };
    look(&mut s, "notepad.exe");
    assert!(status(&mut s).session.is_none(), "another program: nothing");
    look(&mut s, "code.exe");
    let st = status(&mut s);
    let ses = st.session.expect("the program opened: a session starts");
    assert_eq!(
        (ses.name.as_str(), ses.level),
        ("Deep work", 0),
        "a normal one, that can be ended"
    );
    assert_eq!((ses.ends_at_ms - ses.started_at_ms) / 60_000, 50);
    assert!(
        ses.blocks.contains(&"YouTube".to_string()),
        "it closes what the person called distracting"
    );
    // it ends by the person's hand, and coming back to the program does not start it again within the hour
    s.p.session = None;
    look(&mut s, "notepad.exe");
    look(&mut s, "code.exe");
    assert!(status(&mut s).session.is_none(), "not twice within an hour");
    advance(&f, &mut s, 61 * 60);
    look(&mut s, "notepad.exe");
    look(&mut s, "code.exe");
    assert!(
        status(&mut s).session.is_some(),
        "after an hour it can start again"
    );
}

#[test]
fn an_agent_cannot_make_the_service_close_what_it_names() {
    // "only code" is running; the request names a protected system process under a made-up program name,
    // another real process under the name of an allowed program, and a process number that does not exist
    let (f, mut s) = world();
    setup(&mut s);
    set(
        &mut s,
        json!({"et-items": [{"name":"VS Code","type":"app","g":"allow"}]}),
    );
    s.handle(Request::StartSession {
        name: "Only code".into(),
        minutes: 30,
        level: 1,
        blocks: vec!["Everything".into()],
        scene: "".into(),
        allow_breaks: false,
        dnd: false,
        mute: false,
        close_now: false,
    });
    f.0.lock().unwrap().procs = vec![
        proc(40, "code.exe"),
        proc(60, "winlogon.exe"),
        proc(61, "wsc_av.exe"),
        proc(62, "svchost.exe"),
    ];
    for _ in 0..14 {
        s.handle(Request::Observe {
            fg: None,
            idle_secs: 0,
            windows: vec![
                Win {
                    exe: "x.exe".into(),
                    title: "".into(),
                    pid: 60,
                }, // the real program is winlogon.exe: never closed
                Win {
                    exe: "code.exe".into(),
                    title: "".into(),
                    pid: 61,
                }, // claims to be allowed; the real one is not and is closed only if it really is not on the list
                Win {
                    exe: "x.exe".into(),
                    title: "".into(),
                    pid: 9999,
                }, // there is no such process
            ],
            screen_locked: false,
        });
        advance(&f, &mut s, 2);
    }
    let killed = f.0.lock().unwrap().killed.clone();
    assert!(
        !killed.contains(&60),
        "a system process is never closed because a request said so"
    );
    assert!(!killed.contains(&9999));
}

#[test]
fn closing_by_force_names_the_program_and_refuses_another_one_under_the_same_number() {
    use crate::os::Os;
    let (f, _s) = world();
    f.0.lock().unwrap().procs = vec![proc(10, "calc.exe")];
    // number 10 used to be steam.exe: the order names it, the computer says it is calc.exe now
    assert!(!f.terminate(10, "steam.exe"));
    assert!(f.0.lock().unwrap().killed.is_empty());
    assert!(
        f.terminate(10, "CALC.EXE"),
        "names are compared without regard to case"
    );
    assert_eq!(f.0.lock().unwrap().killed, vec![10]);
}

// ---------- the optional anonymous numbers ----------

const COLLECTOR: &str = "https://collector.example/v1/usage";

fn tele(s: &mut Supervisor<Fake>) -> Value {
    s.handle(Request::TelemetryGet).data
}

#[test]
fn what_happens_is_counted_as_kinds_and_never_as_names() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().procs = vec![proc(10, "steam.exe"), proc(12, "explorer.exe")];
    assert!(start(&mut s, 25, 1).ok);
    advance(&f, &mut s, 24);
    advance(&f, &mut s, 25 * 60);
    s.handle(Request::GetState);
    let c = s.handle(Request::Challenge {
        action: "end_session".into(),
        target: None,
        minutes: None,
    });
    assert!(c.ok || !c.ok); // (no session is running any more: whatever it answers, it is a challenge or a refusal)
    let t = &s.p.tele;
    for name in [
        "ses_start",
        "ses_done",
        "ui_open",
        "svc_start",
        "blk_session",
    ] {
        assert!(
            t.period.get(name).copied().unwrap_or(0) >= 1,
            "{name} was counted: {:?}",
            t.period
        );
    }
    assert!(!t.period.contains_key("svc_unclean"));
    let text = serde_json::to_string(&s.p.tele).unwrap();
    assert!(
        !text.contains("steam") && !text.contains("youtube") && !text.contains("Deep work"),
        "no name of a program, a site or a session: {text}"
    );
    assert!(!s.p.tele.on, "counting never switches anything on");
}

#[test]
fn a_service_that_did_not_stop_on_purpose_is_counted_when_it_comes_back() {
    let (f, mut s) = world();
    advance(&f, &mut s, 4); // the first save: the store says the service is running
    let store = f.0.lock().unwrap().store.clone();
    assert!(
        store.as_deref().unwrap_or("").contains("\"running\":true"),
        "{store:?}"
    );
    // a clean stop: the next start is a plain start
    s.shutdown(false);
    let s2 = Supervisor::new(f.clone());
    assert!(
        !s2.p.tele.period.contains_key("svc_unclean"),
        "{:?}",
        s2.p.tele.period
    );
    // a stop that was never announced (the store still says "running")
    f.0.lock().unwrap().store = store;
    let s3 = Supervisor::new(f.clone());
    assert_eq!(
        s3.p.tele.period.get("svc_unclean"),
        Some(&1),
        "{:?}",
        s3.p.tele.period
    );
}

#[test]
fn nothing_is_asked_shown_as_due_or_sent_without_a_yes_and_a_collector() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().procs = vec![proc(10, "steam.exe")];
    for _ in 0..4 {
        assert!(start(&mut s, 5, 1).ok);
        advance(&f, &mut s, 6 * 60);
        f.0.lock().unwrap().wall += 86_400_000;
        f.0.lock().unwrap().mono += 86_400_000;
    }
    let v = tele(&mut s);
    assert_eq!(v["configured"], false, "this build has no collector");
    assert_eq!(v["ask"], false, "so the app asks nothing");
    assert_eq!(v["on"], false);
    assert!(
        s.telemetry_job("").is_none() && s.telemetry_job(COLLECTOR).is_none(),
        "nobody said yes: nothing is due, even with a collector"
    );
    let r = v["report"].as_str().unwrap();
    assert!(
        r.contains(&"0".repeat(32)) && r.contains("\"pr\":\"win\""),
        "the preview before a yes holds no identifier: {r}"
    );
}

#[test]
fn a_yes_makes_a_weekly_report_that_the_collector_accepts_and_a_no_asks_it_to_forget() {
    let (f, mut s) = world();
    setup(&mut s);
    f.0.lock().unwrap().procs = vec![proc(10, "steam.exe")];
    assert!(start(&mut s, 5, 1).ok);
    advance(&f, &mut s, 6 * 60);
    let v = s.handle(Request::TelemetrySet { on: true }).data;
    assert_eq!(v["on"], true);
    assert!(
        s.telemetry_job(COLLECTOR).is_none(),
        "the first report comes the day after"
    );
    {
        let mut w = f.0.lock().unwrap();
        w.wall += 21 * 3_600_000;
        w.mono += 21 * 3_600_000;
    }
    assert!(
        s.telemetry_job("http://collector.example/v1/usage")
            .is_none(),
        "only over https"
    );
    let job = s.telemetry_job(COLLECTOR).expect("due");
    assert!(
        !job.forget && eyetime_core::telemetry::validate(&job.body).is_ok(),
        "{}",
        job.body
    );
    assert!(
        job.body.contains("\"ses_start\":1")
            && !job.body.contains("steam")
            && !job.body.contains("Deep"),
        "{}",
        job.body
    );
    assert!(s.telemetry_job(COLLECTOR).is_none(), "one try at a time");
    // it did not get through: the next try waits six hours, and the counters stay
    s.telemetry_done(&job, None);
    assert!(!s.p.tele.period.is_empty());
    {
        let mut w = f.0.lock().unwrap();
        w.wall += 7 * 3_600_000;
    }
    let again = s.telemetry_job(COLLECTOR).expect("six hours later");
    s.telemetry_done(&again, Some(204));
    assert!(
        !s.p.tele.period.contains_key("ses_start"),
        "what was sent is taken away"
    );
    assert!(
        s.telemetry_job(COLLECTOR).is_none(),
        "and the next one is a week away"
    );
    // a no: the collector is asked to forget, until it has been told
    let id = s.p.tele.id.clone();
    assert_eq!(id.len(), 32);
    let off = s.handle(Request::TelemetrySet { on: false }).data;
    assert_eq!(off["on"], false);
    let forget = s.telemetry_job(COLLECTOR).expect("forget");
    assert!(
        forget.forget && forget.body.contains(&id),
        "{}",
        forget.body
    );
    s.telemetry_done(&forget, Some(503));
    assert!(s.telemetry_job(COLLECTOR).is_none(), "retried in six hours");
    f.0.lock().unwrap().wall += 7 * 3_600_000;
    let forget = s.telemetry_job(COLLECTOR).expect("forget again");
    s.telemetry_done(&forget, Some(204));
    f.0.lock().unwrap().wall += 30 * 86_400_000;
    assert!(
        s.telemetry_job(COLLECTOR).is_none(),
        "nothing more is ever sent"
    );
}

#[test]
fn only_the_window_may_touch_the_switch_and_a_no_is_final() {
    use eyetime_core::ipc::Role;
    for req in [
        Request::TelemetryGet,
        Request::TelemetrySet { on: true },
        Request::TelemetryDecline,
        Request::TelemetryDefer,
    ] {
        assert!(Role::Window.allows(&req) && Role::Admin.allows(&req));
        assert!(
            !Role::Agent.allows(&req) && !Role::Other.allows(&req),
            "{req:?}"
        );
    }
    let (_f, mut s) = world();
    s.handle(Request::TelemetryDecline);
    assert!(tele(&mut s)["asked"] == true && s.p.tele.asked_ms > 0 && !s.p.tele.on);
}

struct FakePost {
    sent: Mutex<Vec<(String, String)>>,
    answer: Mutex<Result<u16, String>>,
}
impl crate::telemetry_send::Post for FakePost {
    fn post_json(&self, url: &str, body: &str) -> Result<u16, String> {
        self.sent.lock().unwrap().push((url.into(), body.into()));
        self.answer.lock().unwrap().clone()
    }
}

#[test]
fn the_sender_posts_what_is_due_once_and_only_after_a_yes() {
    use crate::telemetry_send::step;
    let (f, s) = world();
    let post = FakePost {
        sent: Mutex::new(vec![]),
        answer: Mutex::new(Ok(204)),
    };
    let sup = Mutex::new(s);
    {
        let mut s = sup.lock().unwrap();
        s.handle(Request::GetState);
    }
    f.0.lock().unwrap().wall += 40 * 3_600_000;
    assert!(!step(&sup, &post, COLLECTOR), "no yes, nothing is posted");
    sup.lock()
        .unwrap()
        .handle(Request::TelemetrySet { on: true });
    assert!(
        !step(&sup, &post, COLLECTOR),
        "the first report waits a day"
    );
    f.0.lock().unwrap().wall += 21 * 3_600_000;
    assert!(
        !step(&sup, &post, ""),
        "a build with no collector posts nothing"
    );
    assert!(step(&sup, &post, COLLECTOR));
    assert!(!step(&sup, &post, COLLECTOR), "once");
    let sent = post.sent.lock().unwrap();
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].0, COLLECTOR);
    assert!(
        sent[0].1.contains("\"pr\":\"win\"") && sent[0].1.contains("\"ui_open\":1"),
        "{}",
        sent[0].1
    );
    drop(sent);
    // the network is down: tried, kept, and tried again in six hours
    f.0.lock().unwrap().wall += 8 * 86_400_000;
    *post.answer.lock().unwrap() = Err("no connection".into());
    assert!(step(&sup, &post, COLLECTOR));
    assert!(!step(&sup, &post, COLLECTOR));
    f.0.lock().unwrap().wall += 7 * 3_600_000;
    *post.answer.lock().unwrap() = Ok(204);
    assert!(step(&sup, &post, COLLECTOR));
    assert_eq!(post.sent.lock().unwrap().len(), 3);
}
