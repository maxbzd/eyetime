//! What the window, the browser extension and the helper say to each other. One JSON object per line over a named pipe.
//! The window may ask for anything; the helper decides what it gets.

use crate::engine::{Decision, Grants};
use crate::friction::Challenge;
use crate::model::Session;
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
    SetState { keys: HashMap<String, Value>, #[serde(default)] pin: Option<String> },
    StartSession { name: String, minutes: u32, level: u8, #[serde(default)] blocks: Vec<String>, #[serde(default)] scene: String, #[serde(default)] allow_breaks: bool, #[serde(default)] dnd: bool, #[serde(default)] mute: bool, #[serde(default)] close_now: bool },
    /// Ask to be let out of something. The helper answers with what the person must do.
    Challenge { action: String, #[serde(default)] target: Option<String>, #[serde(default)] minutes: Option<u32> },
    /// The answer. If it is right the helper does what the challenge was for.
    Complete { challenge_id: String, #[serde(default)] answer: String, #[serde(default)] pin: Option<String>, #[serde(default)] partner_code: Option<String> },
    SetPin { #[serde(default)] old: Option<String>, new: String },
    SetPartnerPin { #[serde(default)] old: Option<String>, new: String },
    /// the browser extension: which address is in front (none when the browser is in the background)
    Site { #[serde(default)] host: Option<String>, #[serde(default)] incognito: bool, #[serde(default)] browser: String },
    Decision,
    Usage,
    /// the installer and the window ask before uninstalling
    Uninstall { #[serde(default)] pin: Option<String> },
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
        Response { ok: true, code: String::new(), message: String::new(), data: serde_json::to_value(data).unwrap_or(Value::Null) }
    }
    pub fn done() -> Response {
        Response { ok: true, ..Default::default() }
    }
    pub fn err(code: &str, message: impl Into<String>) -> Response {
        Response { ok: false, code: code.into(), message: message.into(), data: Value::Null }
    }
    pub fn err_with(code: &str, message: impl Into<String>, data: impl Serialize) -> Response {
        Response { ok: false, code: code.into(), message: message.into(), data: serde_json::to_value(data).unwrap_or(Value::Null) }
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
        let r = Request::Challenge { action: "end_session".into(), target: None, minutes: Some(5) };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"op\":\"challenge\""));
        assert_eq!(parse_request(&s).unwrap(), r);
        assert!(parse_request("{\"op\":\"format_disk\"}").is_err());
        assert!(parse_request("not json").is_err());
        assert_eq!(parse_request("{\"op\":\"ping\"}\n").unwrap(), Request::Ping);
    }

    #[test]
    fn short_forms_fill_in_defaults() {
        let r = parse_request(r#"{"op":"start_session","name":"x","minutes":25,"level":1}"#).unwrap();
        assert!(matches!(r, Request::StartSession { allow_breaks: false, .. }));
        let r = parse_request(r#"{"op":"site","host":"youtube.com"}"#).unwrap();
        assert!(matches!(r, Request::Site { incognito: false, .. }));
    }

    #[test]
    fn a_challenge_never_carries_its_answer() {
        let p = crate::model::Protect { friction: "type".into(), ..Default::default() };
        let c = Challenge::new(&p, "break", 0, 1, 0);
        let v = challenge_data(&c);
        assert!(v.get("answer").is_none());
        assert!(!c.answer.is_empty());
    }

    #[test]
    fn oversize_lines_are_refused() {
        assert!(parse_request(&"x".repeat(MAX_LINE + 1)).is_err());
    }
}
