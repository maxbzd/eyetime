// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! What the window, the browser extension and the helper say to each other. One JSON object per line over a named pipe.
//! The window may ask for anything; the helper decides what it gets.

use crate::engine::{Decision, Grants};
use crate::friction::Challenge;
use crate::model::Session;
use crate::update::{UpdateInfo, Updated};
use crate::usage::DayUsage;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const PIPE_NAME: &str = r"\\.\pipe\eyetime-helper";
pub const MAX_LINE: usize = 2 * 1024 * 1024;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Request {
    Ping,
    Status,
    /// the eight keys the screens keep
    GetState,
    /// Changes to the setup. While a locked block runs, anything that loosens it is refused.
    SetState {
        keys: HashMap<String, Value>,
        #[serde(default)]
        pin: Option<String>,
    },
    StartSession {
        name: String,
        minutes: u32,
        level: u8,
        #[serde(default)]
        blocks: Vec<String>,
        #[serde(default)]
        scene: String,
        #[serde(default)]
        allow_breaks: bool,
        #[serde(default)]
        dnd: bool,
        #[serde(default)]
        mute: bool,
        #[serde(default)]
        close_now: bool,
    },
    /// Ask to be let out of something. The helper answers with what the person must do.
    Challenge {
        action: String,
        #[serde(default)]
        target: Option<String>,
        #[serde(default)]
        minutes: Option<u32>,
    },
    /// The answer. If it is right the helper does what the challenge was for.
    Complete {
        challenge_id: String,
        #[serde(default)]
        answer: String,
        #[serde(default)]
        pin: Option<String>,
        #[serde(default)]
        partner_code: Option<String>,
    },
    SetPin {
        #[serde(default)]
        old: Option<String>,
        new: String,
    },
    SetPartnerPin {
        #[serde(default)]
        old: Option<String>,
        new: String,
    },
    /// the browser extension: which address is in front (none when the browser is in the background)
    Site {
        #[serde(default)]
        host: Option<String>,
        #[serde(default)]
        incognito: bool,
        #[serde(default)]
        browser: String,
    },
    Decision,
    Usage,
    /// end a break and take back any "unblocked for a while" that was granted
    Resume,
    /// look for a newer version now
    UpdateCheck,
    /// download the newer version and install it (it waits while a locked block runs)
    UpdateInstall,
    UpdateSetAuto {
        on: bool,
    },
    /// the "what is new" was shown
    UpdateAck,
    /// the anonymous numbers: whether sharing is on, whether to ask, and the exact next report
    TelemetryGet,
    /// switch sharing on or off (it is never on unless the window asks, and only the window may)
    TelemetrySet {
        on: bool,
    },
    /// "no thank you" to the one-time question: it is not asked again
    TelemetryDecline,
    /// the installer and the window ask before uninstalling
    Uninstall,
    /// the little agent in the person's session: what it sees, every couple of seconds. The answer is what it should do.
    Observe {
        #[serde(default)]
        fg: Option<Fg>,
        #[serde(default)]
        idle_secs: u32,
        #[serde(default)]
        windows: Vec<Win>,
        #[serde(default)]
        screen_locked: bool,
    },
}

/// Who is on the other end of the pipe, as the service itself finds out (the program's real file and whether it runs elevated), never as the
/// request says. The pipe is open to every signed-in person, so what each kind of client may ask is decided here.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    /// the installed window (eyetime.exe)
    Window,
    /// the installed helper program run in a person's session: the screen agent and the browser's native host
    Agent,
    /// the system, or a program started as an administrator (the installer, the checks)
    Admin,
    /// anything else that a signed-in person runs
    Other,
}

impl Role {
    pub fn allows(self, req: &Request) -> bool {
        match self {
            Role::Admin => true,
            Role::Window => !matches!(req, Request::Observe { .. }),
            Role::Agent => matches!(
                req,
                Request::Observe { .. }
                    | Request::Site { .. }
                    | Request::Decision
                    | Request::Ping
                    | Request::Status
            ),
            Role::Other => matches!(req, Request::Ping | Request::Status),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Fg {
    pub exe: String,
    pub title: String,
    pub pid: u32,
}

/// a window on the screen
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Win {
    pub exe: String,
    pub title: String,
    pub pid: u32,
}

/// What the agent in the person's session has to do (it can reach windows, the service cannot).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Orders {
    pub close_private: bool,
    pub mute: bool,
    pub dnd: bool,
    /// programs that are asked to close politely (so that they can offer to save), before they are closed by force
    pub close_pids: Vec<u32>,
    /// open the window again (after an update)
    pub launch_app: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BlockEvent {
    pub at_ms: i64,
    /// "app" | "private" | "vpn" | "tool" | "site"
    pub kind: String,
    pub name: String,
    pub reason: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub version: String,
    pub now_ms: i64,
    pub decision: Decision,
    pub session: Option<Session>,
    pub grants: Grants,
    pub today: DayUsage,
    pub emergency_left: u32,
    pub emergency_total: u32,
    pub pin_set: bool,
    pub partner_set: bool,
    pub clock_tampered: bool,
    pub safe_mode_guard: bool,
    pub hosts_ok: bool,
    /// the dead-man switch: a frozen block ends by itself at this time whatever happens
    pub frozen_limit_ms: Option<i64>,
    pub streak_days: u32,
    pub events: Vec<BlockEvent>,
    pub agent_connected: bool,
    pub ext_connected: bool,
    pub emergency_until_ms: i64,
    /// minutes of focus per day, last five weeks, oldest first (the last one is today)
    pub focus_minutes: Vec<u32>,
    pub totals: Totals,
    pub update: UpdateView,
}

/// what the person has done since EyeTime was installed (for the profile and the stones)
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Totals {
    /// minutes of focus sessions that ran to their end
    pub focus_min: u64,
    pub sessions: u32,
    pub best_streak: u32,
    /// the first day EyeTime saw (YYYY-MM-DD), empty before the first look
    pub since_day: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct UpdateView {
    /// "idle" | "checking" | "available" | "downloading" | "ready" | "installing" | "error"
    pub state: String,
    pub current: String,
    pub info: Option<UpdateInfo>,
    pub pct: u32,
    pub error: String,
    /// how long ago the last look at the network was (-1: not yet)
    pub checked_ago_ms: i64,
    pub auto: bool,
    pub waiting_for_lock: bool,
    /// set once, right after an update was installed
    pub updated: Option<Updated>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Response {
    pub ok: bool,
    /// machine-readable reason when `ok` is false: "locked" "pin" "pin_locked" "early" "wrong" "expired" "bad_request" "none" "denied"
    pub code: String,
    pub message: String,
    pub data: Value,
}

impl Response {
    pub fn ok(data: impl Serialize) -> Response {
        Response {
            ok: true,
            code: String::new(),
            message: String::new(),
            data: serde_json::to_value(data).unwrap_or(Value::Null),
        }
    }
    pub fn done() -> Response {
        Response {
            ok: true,
            ..Default::default()
        }
    }
    pub fn err(code: &str, message: impl Into<String>) -> Response {
        Response {
            ok: false,
            code: code.into(),
            message: message.into(),
            data: Value::Null,
        }
    }
    pub fn err_with(code: &str, message: impl Into<String>, data: impl Serialize) -> Response {
        Response {
            ok: false,
            code: code.into(),
            message: message.into(),
            data: serde_json::to_value(data).unwrap_or(Value::Null),
        }
    }
}

pub fn challenge_data(c: &Challenge) -> Value {
    serde_json::to_value(c.public()).unwrap_or(Value::Null)
}

pub fn parse_request(line: &str) -> Result<Request, String> {
    if line.len() > MAX_LINE {
        return Err("too long".into());
    }
    serde_json::from_str(line.trim()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_round_trip_and_unknown_ones_are_refused() {
        let r = Request::Challenge {
            action: "end_session".into(),
            target: None,
            minutes: Some(5),
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"op\":\"challenge\""));
        assert_eq!(parse_request(&s).unwrap(), r);
        assert!(parse_request("{\"op\":\"format_disk\"}").is_err());
        assert!(parse_request("not json").is_err());
        assert_eq!(parse_request("{\"op\":\"ping\"}\n").unwrap(), Request::Ping);
    }

    #[test]
    fn short_forms_fill_in_defaults() {
        let r =
            parse_request(r#"{"op":"start_session","name":"x","minutes":25,"level":1}"#).unwrap();
        assert!(matches!(
            r,
            Request::StartSession {
                allow_breaks: false,
                ..
            }
        ));
        let r = parse_request(r#"{"op":"site","host":"youtube.com"}"#).unwrap();
        assert!(matches!(
            r,
            Request::Site {
                incognito: false,
                ..
            }
        ));
    }

    #[test]
    fn a_challenge_never_carries_its_answer() {
        let p = crate::model::Protect {
            friction: "type".into(),
            ..Default::default()
        };
        let c = Challenge::new(&p, "break", 0, 1, 0);
        let v = challenge_data(&c);
        assert!(v.get("answer").is_none());
        assert!(!c.answer.is_empty());
    }

    #[test]
    fn oversize_lines_are_refused() {
        assert!(parse_request(&"x".repeat(MAX_LINE + 1)).is_err());
    }

    #[test]
    fn no_line_whatsoever_makes_the_parser_panic_and_what_it_accepts_goes_round() {
        let seeds = [
            "{\"op\":\"ping\"}",
            "{\"op\":\"challenge\",\"action\":\"end_session\",\"minutes\":5}",
            "{\"op\":\"observe\",\"fg\":{\"exe\":\"a.exe\"},\"idle_secs\":3}",
            "{\"op\":\"set_state\",\"keys\":{\"et-kw\":[\"x\"]}}",
            "",
            "[]",
            "null",
            "{\"op\":",
        ];
        let mut x = 0x2545_F491_4F6C_DD1Du64;
        let mut rnd = move || {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            x
        };
        for _ in 0..3000 {
            let mut b = seeds[(rnd() % seeds.len() as u64) as usize]
                .as_bytes()
                .to_vec();
            for _ in 0..(rnd() % 6) {
                if b.is_empty() {
                    b.push(b'{');
                }
                let i = (rnd() % b.len() as u64) as usize;
                match rnd() % 4 {
                    0 => b[i] = (rnd() % 128) as u8,
                    1 => {
                        b.remove(i);
                    }
                    2 => {
                        let junk = br#"{}[]":,\"#;
                        b.insert(i, junk[(rnd() % junk.len() as u64) as usize]);
                    }
                    _ => b.truncate(i),
                }
            }
            let line = String::from_utf8_lossy(&b).to_string();
            if let Ok(req) = parse_request(&line) {
                let again = serde_json::to_string(&req).unwrap();
                assert_eq!(
                    parse_request(&again).unwrap(),
                    req,
                    "round trip of {line:?}"
                );
                // a request that parsed is one the role table has an answer for (no panic in the table either)
                for role in [Role::Window, Role::Agent, Role::Admin, Role::Other] {
                    let _ = role.allows(&req);
                }
            }
        }
    }
}
