// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! The optional, anonymous report of the Windows app, and the counters behind it. Off unless the person says yes; nothing leaves the computer without that
//! yes; the exact next report can be read in the app before it is sent. This file only decides and builds: the helper does the sending.
//!
//! The report has the same shape as the browser extension's (`src/shared/usage-schema.js` is the one source of truth for the names, and a test below reads that file),
//! with `pr` = "win" and shorter lists. A counter counts a *kind* of event. It can never hold a program, a site, a path, a window title, a rule name, a PIN or a time of day.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Where the report goes. Empty until the collector exists (server/usage/README.md): with no address nothing can be sent, even if someone switched sharing on.
pub const COLLECTOR: &str = "";

/// What is counted: kinds of events, never what they were about.
pub const COUNTERS: [&str; 28] = [
    "blk_rule",
    "blk_session",
    "blk_limit",
    "blk_cool",
    "ch_shown",
    "ch_done",
    "ch_wrong",
    "ch_expired",
    "ch_hold",
    "ch_wait",
    "ch_type",
    "ch_math",
    "ch_pin",
    "ch_friend",
    "ch_for_end",
    "ch_for_break",
    "ch_for_unblock",
    "ch_for_edit",
    "ch_for_emergency",
    "ses_start",
    "ses_done",
    "ses_stop",
    "ui_open",
    "svc_start",
    "svc_unclean",
    "upd_found",
    "upd_applied",
    "upd_failed",
];

/// What is set up (a state): names from the schema's list.
pub const FLAGS: [&str; 11] = [
    "pin",
    "partner_pin",
    "auto_update",
    "browser_ext",
    "locked_rules",
    "limits",
    "schedule",
    "sessions_used",
    "strict",
    "w10",
    "w11",
];

/// The languages a report may name (the extension's list).
pub const LANGS: [&str; 11] = [
    "en", "ru", "es", "de", "fr", "pt", "it", "pl", "uk", "zh", "ja",
];

const DAY_MS: i64 = 86_400_000;
const WEEK_MS: i64 = 7 * DAY_MS;
const FIRST_REPORT_AFTER_MS: i64 = 20 * 3_600_000;
const RETRY_AFTER_MS: i64 = 6 * 3_600_000;
const KEEP_DAYS: usize = 60;
const MAX_COUNT: u32 = 100_000;
const MAX_AGE: i64 = 4000;
/// the one-time question is asked after this many days of use, and once something was closed
pub const ASK_AFTER_DAYS: usize = 3;

fn known(name: &str) -> bool {
    COUNTERS.contains(&name)
}

/// The consent and the counters, kept with the rest of the service's state.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct Telemetry {
    pub on: bool,
    /// 32 hex digits, made when sharing is switched on; replaced when it is switched off and on again
    pub id: String,
    pub opt_in_ms: i64,
    /// the one-time question was answered, either way; it is never asked again
    pub asked_ms: i64,
    pub last_report_ms: i64,
    pub last_try_ms: i64,
    /// the local day (days since 1970) of the first use; ages are counted from it
    pub base_day: i64,
    /// the ages on which the app was used
    pub days: Vec<u32>,
    /// the age at which each counter was first used
    pub first: BTreeMap<String, u32>,
    /// uses since the last report that went out
    pub period: BTreeMap<String, u32>,
    /// an identifier that was switched off and that the collector has not yet been asked to forget
    pub forget: String,
}

impl Telemetry {
    fn day_of(now_ms: i64, tz_ms: i64) -> i64 {
        (now_ms + tz_ms).div_euclid(DAY_MS)
    }

    fn age(&self, now_ms: i64, tz_ms: i64) -> i64 {
        (Self::day_of(now_ms, tz_ms) - self.base_day).clamp(0, MAX_AGE)
    }

    /// The app was used today (opened, or something was counted).
    pub fn touch(&mut self, now_ms: i64, tz_ms: i64) {
        if self.base_day == 0 {
            self.base_day = Self::day_of(now_ms, tz_ms);
        }
        let age = self.age(now_ms, tz_ms) as u32;
        if !self.days.contains(&age) {
            self.days.push(age);
            self.days.sort_unstable();
            if self.days.len() > KEEP_DAYS {
                self.days.remove(0);
            }
        }
    }

    /// Count one use of a kind of event (a name that is not in the list is ignored). Always local.
    pub fn record(&mut self, name: &str, now_ms: i64, tz_ms: i64) {
        if !known(name) {
            return;
        }
        self.touch(now_ms, tz_ms);
        let age = self.age(now_ms, tz_ms) as u32;
        self.first.entry(name.to_string()).or_insert(age);
        let n = self.period.entry(name.to_string()).or_insert(0);
        *n = (*n + 1).min(MAX_COUNT);
    }

    /// Switch sharing on with a fresh random identifier (the caller brings 128 random bits).
    pub fn enable(&mut self, now_ms: i64, id_bits: [u8; 16]) {
        self.on = true;
        self.id = id_bits.iter().map(|b| format!("{b:02x}")).collect();
        self.opt_in_ms = now_ms;
        self.asked_ms = now_ms;
        self.last_report_ms = 0;
        self.last_try_ms = 0;
    }

    /// Switch sharing off. Returns the identifier the collector should be asked to forget (None if there was none).
    pub fn disable(&mut self, now_ms: i64) -> Option<String> {
        let old = (!self.id.is_empty()).then(|| std::mem::take(&mut self.id));
        if let Some(id) = &old {
            self.forget = id.clone();
        }
        self.on = false;
        self.asked_ms = self.asked_ms.max(now_ms);
        self.last_report_ms = 0;
        self.last_try_ms = 0;
        old
    }

    /// Is the collector still to be asked to forget an identifier? (retried every six hours)
    pub fn forget_due(&self, now_ms: i64, have_collector: bool) -> bool {
        have_collector
            && self.forget.len() == 32
            && (self.last_try_ms == 0 || now_ms - self.last_try_ms >= RETRY_AFTER_MS)
    }

    /// The collector was told (or answered that it has nothing).
    pub fn forgotten(&mut self) {
        self.forget.clear();
    }

    /// "No, thank you" to the one-time question: it is not asked again.
    pub fn decline(&mut self, now_ms: i64) {
        self.asked_ms = now_ms.max(1);
    }

    /// Should the app ask now? Only with a collector to share with, only once, only after a few days of use and once something was closed.
    pub fn should_ask(&self, have_collector: bool) -> bool {
        have_collector
            && !self.on
            && self.asked_ms == 0
            && self.days.len() >= ASK_AFTER_DAYS
            && self.first.keys().any(|k| k.starts_with("blk_"))
    }

    /// Is a report due? Weekly; the first one a day after switching on; a failed try waits six hours.
    pub fn due(&self, now_ms: i64, have_collector: bool) -> bool {
        if !have_collector || !self.on || self.id.len() != 32 {
            return false;
        }
        if self.last_try_ms != 0 && now_ms - self.last_try_ms < RETRY_AFTER_MS {
            return false;
        }
        if self.last_report_ms == 0 {
            return now_ms - self.opt_in_ms.max(1) >= FIRST_REPORT_AFTER_MS;
        }
        now_ms - self.last_report_ms >= WEEK_MS - 3_600_000
    }

    /// The report as it would be sent now: one line of JSON, keys in a fixed order. `flags` are names from FLAGS (others are dropped).
    pub fn report(&self, now_ms: i64, tz_ms: i64, app: &str, lang: &str, flags: &[&str]) -> String {
        let id = if self.id.len() == 32 {
            self.id.clone()
        } else {
            "0".repeat(32)
        };
        let age = self.age(now_ms, tz_ms) as u32;
        let act: Vec<u32> = self.days.iter().copied().filter(|d| *d <= age).collect();
        let lang = if LANGS.contains(&lang) { lang } else { "en" };
        let fl: Vec<&str> = FLAGS
            .iter()
            .copied()
            .filter(|f| flags.contains(f))
            .collect();
        format!(
            "{{\"v\":1,\"id\":{},\"pr\":\"win\",\"app\":{},\"lang\":{},\"age\":{},\"act\":{},\"first\":{},\"ft\":{},\"fl\":{}}}",
            js(&id),
            js(&app),
            js(&lang),
            age,
            js(&act),
            js(&self.first),
            js(&self.period),
            js(&fl)
        )
    }

    /// After a report was accepted: take away exactly what was in it (a use that happened on its way is counted next time).
    pub fn after_sent(&mut self, sent: &BTreeMap<String, u32>, now_ms: i64) {
        for (k, n) in sent {
            if let Some(v) = self.period.get_mut(k) {
                *v = v.saturating_sub(*n);
                if *v == 0 {
                    self.period.remove(k);
                }
            }
        }
        self.last_report_ms = now_ms;
        self.last_try_ms = now_ms;
    }

    /// A try that did not get through (the next one waits six hours).
    pub fn tried(&mut self, now_ms: i64) {
        self.last_try_ms = now_ms;
    }
}

/// The request that makes the collector forget an identifier.
pub fn forget_body(id: &str) -> String {
    format!("{{\"v\":1,\"op\":\"forget\",\"id\":\"{id}\"}}")
}

/// What the collector itself checks (mirror of `validateReport` for the Windows app): the app never sends a report that it would refuse.
pub fn validate(text: &str) -> Result<(), String> {
    let v: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    let o = v.as_object().ok_or("not an object")?;
    const KEYS: [&str; 10] = [
        "v", "id", "pr", "app", "lang", "age", "act", "first", "ft", "fl",
    ];
    if let Some(k) = o.keys().find(|k| !KEYS.contains(&k.as_str())) {
        return Err(format!("unknown key {k}"));
    }
    if o.get("v").and_then(|x| x.as_i64()) != Some(1) {
        return Err("version".into());
    }
    if o.get("pr").and_then(|x| x.as_str()) != Some("win") {
        return Err("product".into());
    }
    let id = o.get("id").and_then(|x| x.as_str()).ok_or("id")?;
    if id.len() != 32
        || !id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err("id".into());
    }
    let app = o.get("app").and_then(|x| x.as_str()).ok_or("app")?;
    let parts: Vec<&str> = app.split('.').collect();
    if parts.len() != 3
        || !parts
            .iter()
            .all(|p| (1..=3).contains(&p.len()) && p.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err("app".into());
    }
    if !LANGS.contains(&o.get("lang").and_then(|x| x.as_str()).ok_or("language")?) {
        return Err("language".into());
    }
    let age = o.get("age").and_then(|x| x.as_i64()).ok_or("age")?;
    if !(0..=MAX_AGE).contains(&age) {
        return Err("age".into());
    }
    let act = o
        .get("act")
        .and_then(|x| x.as_array())
        .ok_or("active days")?;
    let mut seen = std::collections::BTreeSet::new();
    for a in act {
        let n = a.as_i64().ok_or("active days")?;
        if !(0..=MAX_AGE).contains(&n) || !seen.insert(n) {
            return Err("active days".into());
        }
    }
    if act.len() > KEEP_DAYS {
        return Err("active days".into());
    }
    for (name, max) in [("first", MAX_AGE), ("ft", MAX_COUNT as i64)] {
        let m = o.get(name).and_then(|x| x.as_object()).ok_or(name)?;
        for (k, n) in m {
            if !known(k) || !n.as_i64().is_some_and(|n| (0..=max).contains(&n)) {
                return Err(format!("{name}.{k}"));
            }
        }
    }
    let fl = o.get("fl").and_then(|x| x.as_array()).ok_or("flags")?;
    let mut seen = std::collections::BTreeSet::new();
    for f in fl {
        let s = f.as_str().ok_or("flags")?;
        if !FLAGS.contains(&s) || !seen.insert(s) {
            return Err("flags".into());
        }
    }
    if text.len() > 6144 {
        return Err("too big".into());
    }
    Ok(())
}

/// JSON text of a value.
fn js<T: Serialize + ?Sized>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "null".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    const MS: i64 = 1_793_788_200_000; // 2026-11-04 10:30 UTC
    const ID: [u8; 16] = [
        0xab, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
    ];

    /// The array after `export const NAME = [` in the schema file, as the list of its quoted words.
    fn schema_list(name: &str) -> Vec<String> {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../src/shared/usage-schema.js"
        );
        let js = std::fs::read_to_string(path).expect("the schema file is in the repository");
        let at = js
            .find(&format!("export const {name} = ["))
            .unwrap_or_else(|| panic!("{name} is in the schema"));
        let body = &js[at..];
        let body = &body[body.find('[').unwrap() + 1..];
        let body = &body[..body.find("];").unwrap()];
        body.lines()
            .map(|l| l.split("//").next().unwrap_or(""))
            .flat_map(|l| {
                l.split('\'')
                    .skip(1)
                    .step_by(2)
                    .map(String::from)
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    #[test]
    fn the_lists_are_the_ones_of_the_schema() {
        let mut ours: Vec<String> = COUNTERS.iter().map(|s| s.to_string()).collect();
        let mut theirs = schema_list("WIN_FEATURES");
        ours.sort();
        theirs.sort();
        assert_eq!(
            ours, theirs,
            "WIN_FEATURES in src/shared/usage-schema.js and COUNTERS here must be the same list"
        );
        let (mut f, mut g) = (
            FLAGS.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            schema_list("WIN_FLAGS"),
        );
        f.sort();
        g.sort();
        assert_eq!(f, g);
        let (mut l, mut m) = (
            LANGS.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            schema_list("LANGS"),
        );
        l.sort();
        m.sort();
        assert_eq!(l, m);
    }

    #[test]
    fn counting_is_local_and_only_for_names_in_the_list() {
        let mut t = Telemetry::default();
        t.record("blk_rule", MS, 0);
        t.record("blk_rule", MS + 1000, 0);
        t.record("steam.exe", MS, 0);
        t.record("blk_rule:steam.exe", MS, 0);
        assert_eq!(t.period.len(), 1);
        assert_eq!(t.period["blk_rule"], 2);
        assert_eq!(t.first["blk_rule"], 0);
        assert_eq!(t.days, vec![0]);
        t.record("ses_start", MS + 2 * DAY_MS, 0);
        assert_eq!(t.days, vec![0, 2]);
        assert_eq!(t.first["ses_start"], 2);
        assert!(!t.on, "counting never switches anything on");
    }

    #[test]
    fn nothing_is_asked_or_due_without_a_collector_and_a_yes() {
        let mut t = Telemetry::default();
        for d in 0..4 {
            t.record("blk_rule", MS + d * DAY_MS, 0);
        }
        assert!(!t.should_ask(false), "no collector, no question");
        assert!(t.should_ask(true));
        assert!(!t.due(MS + 40 * DAY_MS, true), "no yes, nothing is due");
        t.decline(MS);
        assert!(!t.should_ask(true), "a no is final");
        let mut t = Telemetry::default();
        t.record("blk_rule", MS, 0);
        assert!(!t.should_ask(true), "a few days of use first");
        t.enable(MS, ID);
        assert!(
            !t.due(MS + 3_600_000, true),
            "the first report comes the day after"
        );
        assert!(t.due(MS + 21 * 3_600_000, true));
        assert!(
            !t.due(MS + 21 * 3_600_000, false),
            "a build with no collector sends nothing"
        );
    }

    #[test]
    fn a_report_is_valid_in_the_collectors_eyes_and_carries_no_name() {
        let mut t = Telemetry::default();
        t.enable(MS, ID);
        t.record("blk_rule", MS, 0);
        t.record("ch_shown", MS + DAY_MS, 0);
        t.record("ch_for_break", MS + DAY_MS, 0);
        t.record("upd_applied", MS + 2 * DAY_MS, 0);
        let r = t.report(
            MS + 2 * DAY_MS,
            0,
            "0.2.1",
            "ru",
            &["pin", "w11", "not_a_flag"],
        );
        validate(&r).unwrap();
        assert!(r.starts_with(r#"{"v":1,"id":"ab010203040506070809"#));
        assert!(
            r.contains(r#""pr":"win""#)
                && r.contains(r#""lang":"ru""#)
                && r.contains(r#""fl":["pin","w11"]"#),
            "{r}"
        );
        assert!(r.contains(r#""act":[0,1,2]"#) && r.contains(r#""age":2"#));
        // before sharing is on the identifier is zeros, as in the extension's preview
        let p = Telemetry::default().report(MS, 0, "0.2.1", "xx", &[]);
        assert!(p.contains(&"0".repeat(32)) && p.contains(r#""lang":"en""#));
        validate(&p).unwrap();
    }

    #[test]
    fn the_heaviest_possible_report_has_only_names_from_the_lists_and_fits() {
        let mut t = Telemetry::default();
        t.enable(MS, ID);
        for d in 0..90 {
            for c in COUNTERS.iter() {
                t.record(c, MS + d * DAY_MS, 0);
            }
        }
        let r = t.report(MS + 89 * DAY_MS, 0, "999.999.999", "ja", &FLAGS);
        validate(&r).unwrap();
        assert!(r.len() < 6144, "{} bytes", r.len());
        let v: serde_json::Value = serde_json::from_str(&r).unwrap();
        let mut words = vec![];
        fn walk(v: &serde_json::Value, out: &mut Vec<String>) {
            match v {
                serde_json::Value::String(s) => out.push(s.clone()),
                serde_json::Value::Array(a) => a.iter().for_each(|x| walk(x, out)),
                serde_json::Value::Object(m) => m.iter().for_each(|(k, x)| {
                    out.push(k.clone());
                    walk(x, out)
                }),
                _ => {}
            }
        }
        walk(&v, &mut words);
        let allowed = |w: &str| {
            COUNTERS.contains(&w)
                || FLAGS.contains(&w)
                || LANGS.contains(&w)
                || [
                    "v",
                    "id",
                    "pr",
                    "app",
                    "lang",
                    "age",
                    "act",
                    "first",
                    "ft",
                    "fl",
                    "win",
                    "999.999.999",
                ]
                .contains(&w)
                || (w.len() == 32 && w.bytes().all(|b| b.is_ascii_hexdigit()))
        };
        for w in &words {
            assert!(allowed(w), "a word that is not from a list: {w}");
        }
    }

    #[test]
    fn what_was_sent_is_taken_away_and_what_came_meanwhile_stays() {
        let mut t = Telemetry::default();
        t.enable(MS, ID);
        t.record("blk_rule", MS, 0);
        t.record("blk_rule", MS, 0);
        let sent = t.period.clone();
        t.record("blk_rule", MS + 5, 0);
        t.after_sent(&sent, MS + 10);
        assert_eq!(t.period["blk_rule"], 1);
        assert_eq!(t.last_report_ms, MS + 10);
        assert!(!t.due(MS + 10 + 6 * 24 * 3_600_000, true) && t.due(MS + 10 + WEEK_MS, true));
        t.tried(MS + WEEK_MS + 20);
        assert!(!t.due(MS + WEEK_MS + 30, true), "a failed try waits");
    }

    #[test]
    fn switching_off_forgets_the_identifier_and_asks_the_collector_to() {
        let mut t = Telemetry::default();
        t.enable(MS, ID);
        let id = t.disable(MS + 5).unwrap();
        assert_eq!(id.len(), 32);
        assert!(!t.on && t.id.is_empty() && t.asked_ms > 0);
        assert_eq!(
            forget_body(&id),
            format!(r#"{{"v":1,"op":"forget","id":"{id}"}}"#)
        );
        assert_eq!(Telemetry::default().disable(MS), None);
    }

    #[test]
    fn a_report_that_is_not_the_apps_is_refused_by_the_check() {
        let mut t = Telemetry::default();
        t.enable(MS, ID);
        t.record("blk_rule", MS, 0);
        let good = t.report(MS, 0, "0.2.1", "en", &[]);
        for bad in [
            good.replace(r#""pr":"win""#, r#""pr":"ext""#),
            good.replace(r#""first":{"#, r#""first":{"steam.exe":0,"#),
            good.replace(r#""fl":[]"#, r#""fl":["ritual"]"#),
            good.replace(r#""v":1"#, r#""v":2"#),
            good.replace("}", r#","br":"chrome"}"#),
        ] {
            assert!(validate(&bad).is_err(), "{bad}");
        }
        assert!(validate("not json").is_err());
    }

    /// A fixed story, written as the report the app would send. The JS side (`scripts-dev/tests/usage-win.test.mjs`) reads the same file and runs the collector's own check on it,
    /// so the two languages cannot drift: if this text changes on purpose, run the test with UPDATE_GOLDEN=1 and commit the file.
    #[test]
    fn the_report_of_a_fixed_story_is_the_golden_file_which_the_collector_accepts() {
        let mut t = Telemetry::default();
        t.enable(MS, ID);
        for (d, names) in [
            (
                0,
                vec![
                    "ui_open",
                    "svc_start",
                    "blk_rule",
                    "blk_rule",
                    "blk_session",
                ],
            ),
            (
                1,
                vec![
                    "ch_shown",
                    "ch_hold",
                    "ch_for_break",
                    "ch_done",
                    "ses_start",
                ],
            ),
            (3, vec!["ses_done", "upd_found", "upd_applied"]),
        ] {
            for n in names {
                t.record(n, MS + d * DAY_MS, 0);
            }
        }
        let text = t.report(
            MS + 3 * DAY_MS,
            0,
            "0.2.1",
            "ru",
            &["pin", "auto_update", "limits", "w11"],
        );
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../tests/telemetry-golden.json"
        );
        if std::env::var("UPDATE_GOLDEN").is_ok() {
            std::fs::write(path, format!("{text}\n")).unwrap();
        }
        assert_eq!(
            std::fs::read_to_string(path)
                .expect("run once with UPDATE_GOLDEN=1")
                .trim_end(),
            text
        );
        validate(&text).unwrap();
    }
}
