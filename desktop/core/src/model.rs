//! What the person sets up. The interface keeps these as JSON under a handful of keys, the helper reads the same JSON, so the shapes here are
//! the ones the screens write (names and all). Parsing is forgiving: a missing or damaged key becomes its default and never stops the helper.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

/// An app or a site in one of the three lists.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(default)]
pub struct Item {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String, // "app" | "site"
    pub color: String,
    /// "dis" distracting, "neu" neutral, "allow" always allowed
    pub g: String,
    pub domain: String,
    pub exe: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub kind: String, // "schedule" | "timer"
    pub from: String,
    pub to: String,
    /// 0 = Monday … 6 = Sunday
    pub days: Vec<u8>,
    /// "dis" the distracting list, "all" everything except the allowed list, "pick" the chosen ones
    pub block: String,
    pub breaks: bool,
    pub on: bool,
    pub glyph: String,
    pub level: u8,
    pub dur: u32,
}
impl Default for Rule {
    fn default() -> Self {
        Rule { id: String::new(), name: String::new(), kind: "schedule".into(), from: "09:00".into(), to: "17:00".into(), days: vec![0, 1, 2, 3, 4], block: "dis".into(), breaks: true, on: true, glyph: "cal".into(), level: 0, dur: 25 }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct Limit {
    pub id: String,
    pub name: String,
    pub color: String,
    /// "app" | "site" | "cat"
    pub scope: String,
    /// "time" minutes of use, "open" number of launches, "cool" continuous use before a closed spell
    pub kind: String,
    pub amount: u32,
    /// "hour" | "day" | "week"
    pub per: String,
    pub cool: u32,
    pub used: u32,
    pub on: bool,
    /// "block" | "delay" | "warn"
    pub act: String,
}
impl Default for Limit {
    fn default() -> Self {
        Limit { id: String::new(), name: String::new(), color: String::new(), scope: "site".into(), kind: "time".into(), amount: 30, per: "day".into(), cool: 30, used: 0, on: true, act: "block".into() }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(default)]
pub struct Auto {
    pub id: String,
    pub when: String,
    pub wv: String,
    pub then: String,
    pub tv: String,
    pub on: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Tamper {
    pub uninstall: bool,
    pub watchdog: bool,
    pub hosts: bool,
    pub private: bool,
    pub vpn: bool,
    pub ext: bool,
    pub clock: bool,
    pub taskmgr: bool,
    pub safemode: bool,
    pub sleep: bool,
}
impl Default for Tamper {
    fn default() -> Self {
        Tamper { uninstall: true, watchdog: true, hosts: true, private: true, vpn: true, ext: true, clock: true, taskmgr: false, safemode: true, sleep: false }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Protect {
    /// default strictness of sessions: 0 Normal, 1 Timeout, 2 Locked, 3 Frozen
    pub level: u8,
    /// "none" | "hold" | "wait" | "type" | "math" | "friend"
    pub friction: String,
    pub wait_sec: u32,
    pub grow: bool,
    pub type_len: u8,
    pub pin_on: bool,
    pub partner: String,
    pub emerg: u32,
    pub emerg_week: u32,
    pub daily: u32,
    pub len: u32,
    pub reset_streak: bool,
    pub points: bool,
    pub only: bool,
    pub tam: Tamper,
}
impl Default for Protect {
    fn default() -> Self {
        Protect { level: 0, friction: "hold".into(), wait_sec: 30, grow: true, type_len: 1, pin_on: false, partner: String::new(), emerg: 3, emerg_week: 1, daily: 7, len: 5, reset_streak: true, points: false, only: false, tam: Tamper::default() }
    }
}

/// Everything the engine reads, gathered from the interface's keys.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct State {
    pub rules: Vec<Rule>,
    pub items: Vec<Item>,
    pub limits: Vec<Limit>,
    pub auto: Vec<Auto>,
    pub cats: BTreeMap<String, bool>,
    pub keywords: Vec<String>,
    pub exceptions: Vec<String>,
    pub protect: Protect,
}

pub const KEYS: [&str; 8] = ["et-rules", "et-items", "et-limits", "et-auto", "et-cats", "et-kw", "et-ex", "et-protect"];

fn take<T: for<'de> Deserialize<'de> + Default>(m: &HashMap<String, serde_json::Value>, k: &str) -> T {
    m.get(k).and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default()
}

impl State {
    pub fn from_keys(m: &HashMap<String, serde_json::Value>) -> State {
        State {
            rules: take(m, "et-rules"),
            items: take(m, "et-items"),
            limits: take(m, "et-limits"),
            auto: take(m, "et-auto"),
            cats: take(m, "et-cats"),
            keywords: take(m, "et-kw"),
            exceptions: take(m, "et-ex"),
            protect: take(m, "et-protect"),
        }
    }
}

/// A focus session, started by hand. The helper owns it: closing the window does not end it.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub name: String,
    pub started_at_ms: i64,
    pub ends_at_ms: i64,
    pub level: u8,
    /// names from the interface's list of blockable things
    pub blocks: Vec<String>,
    pub scene: String,
    pub allow_breaks: bool,
    pub snooze_until_ms: Option<i64>,
    pub close_now: bool,
    pub dnd: bool,
    pub mute: bool,
}

/// The wall clock as the engine needs it: no time zones in here, the caller says what the local time is.
#[derive(Clone, Debug, PartialEq)]
pub struct Now {
    pub ms: i64,
    /// 0 = Monday … 6 = Sunday
    pub weekday: u8,
    pub minute: u16,
    /// YYYY-MM-DD, local
    pub day: String,
}
impl Now {
    pub fn hour(&self) -> u8 {
        (self.minute / 60) as u8
    }
}
