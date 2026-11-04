//! The decision: given what the person set up, the time, the usage and the running session, what is closed right now, and how hard.
//! Pure function, no clock, no disk. The helper calls it every few seconds and carries the result out.

use crate::catalog::{category_domains, category_exes, item_domains, item_exes, never_close, CATEGORY_NAMES};
use crate::model::{Item, Limit, Now, Session, State};
use crate::schedule::active_for;
use crate::usage::Usage;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// Breaks the person earned by getting through a challenge: "this rule/limit is off until...", or "everything that allows breaks is off until...".
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Grants {
    pub all_until_ms: i64,
    pub ids: BTreeMap<String, i64>,
}
impl Grants {
    pub fn covers(&self, id: &str, now_ms: i64) -> bool {
        self.ids.get(id).map(|u| *u > now_ms).unwrap_or(false)
    }
    pub fn all(&self, now_ms: i64) -> bool {
        self.all_until_ms > now_ms
    }
    pub fn prune(&mut self, now_ms: i64) {
        self.ids.retain(|_, u| *u > now_ms);
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Reason {
    /// "rule" | "session" | "limit" | "cool"
    pub kind: String,
    pub name: String,
    pub mins_left: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Decision {
    /// addresses to close (the hosts file and the browser extension)
    pub domains: Vec<String>,
    /// programs to close (lower case file names)
    pub exes: Vec<String>,
    /// words that close a page whatever the site (extension only)
    pub keywords: Vec<String>,
    /// addresses or address prefixes that stay open even if their site is closed (extension only)
    pub exceptions: Vec<String>,
    /// everything is closed except the lists below
    pub allow_only: bool,
    pub allow_domains: Vec<String>,
    pub allow_exes: Vec<String>,
    /// sites that open after a countdown (limit with "delay")
    pub delay: Vec<String>,
    /// names of limits that only warn
    pub warn: Vec<String>,
    /// 0 Normal, 1 Timeout, 2 Locked, 3 Frozen
    pub level: u8,
    pub close_private: bool,
    pub block_vpn: bool,
    pub lock_taskmgr: bool,
    pub close_tools: bool,
    pub keep_awake: bool,
    pub reasons: Vec<Reason>,
}

impl Decision {
    pub fn active(&self) -> bool {
        self.allow_only || !self.domains.is_empty() || !self.exes.is_empty() || !self.keywords.is_empty()
    }
    pub fn locked(&self) -> bool {
        self.active() && self.level >= 2
    }
    pub fn frozen(&self) -> bool {
        self.level >= 3 && self.active()
    }

    /// Should this program be closed? (The caller decides which running programs it looks at; the safe list always wins.)
    pub fn blocks_exe(&self, exe: &str) -> bool {
        let e = exe.to_lowercase();
        if never_close(&e) {
            return false;
        }
        if self.allow_only {
            return !self.allow_exes.contains(&e);
        }
        self.exes.contains(&e)
    }

    /// Is this address closed? Matches the address itself and everything under it.
    pub fn blocks_host(&self, host: &str) -> bool {
        let h = host.trim().to_lowercase();
        let h = h.trim_start_matches("www.");
        if self.exceptions.iter().any(|x| !x.contains('/') && same_or_under(h, x)) {
            return false;
        }
        if self.allow_only {
            return !self.allow_domains.iter().any(|d| same_or_under(h, d));
        }
        self.domains.iter().any(|d| same_or_under(h, d))
    }
}

pub fn same_or_under(host: &str, domain: &str) -> bool {
    host == domain || (host.len() > domain.len() && host.ends_with(domain) && host.as_bytes()[host.len() - domain.len() - 1] == b'.')
}

#[derive(Default, Clone, Debug, PartialEq)]
pub struct Targets {
    pub domains: BTreeSet<String>,
    pub exes: BTreeSet<String>,
}
impl Targets {
    fn add(&mut self, o: Targets) {
        self.domains.extend(o.domains);
        self.exes.extend(o.exes);
    }
    pub fn is_empty(&self) -> bool {
        self.domains.is_empty() && self.exes.is_empty()
    }
    pub fn keys(&self) -> Vec<String> {
        self.domains.iter().map(|d| format!("site:{d}")).chain(self.exes.iter().map(|e| format!("exe:{e}"))).collect()
    }
}

fn of_item(it: &Item) -> Targets {
    Targets { domains: item_domains(it).into_iter().collect(), exes: item_exes(it).into_iter().collect() }
}

fn of_category(name: &str) -> Targets {
    let low = name.trim().to_lowercase();
    match CATEGORY_NAMES.iter().find(|c| c.to_lowercase() == low) {
        Some(c) => Targets { domains: category_domains(c).iter().map(|s| s.to_string()).collect(), exes: category_exes(c).iter().map(|s| s.to_string()).collect() },
        None => Targets::default(),
    }
}

/// A name from a session or a limit: one of the lists' items, a category, a brand, or an address.
pub fn resolve_name(state: &State, name: &str, scope_hint: &str) -> Targets {
    let low = name.trim().to_lowercase();
    if low.is_empty() {
        return Targets::default();
    }
    if scope_hint == "cat" || CATEGORY_NAMES.iter().any(|c| c.to_lowercase() == low) {
        let t = of_category(&low);
        if !t.is_empty() {
            return t;
        }
    }
    let mut out = Targets::default();
    let mut found = false;
    for it in state.items.iter().filter(|i| i.name.trim().to_lowercase() == low) {
        out.add(of_item(it));
        found = true;
    }
    if found {
        return out;
    }
    let kind = match scope_hint {
        "app" => "app",
        "site" => "site",
        _ if low.contains('.') && !low.ends_with(".exe") => "site",
        _ => "app",
    };
    of_item(&Item { name: name.to_string(), kind: kind.to_string(), ..Default::default() })
}

/// The distracting list: items marked so, the categories switched on.
fn distracting(state: &State) -> Targets {
    let mut t = Targets::default();
    for it in state.items.iter().filter(|i| i.g == "dis") {
        t.add(of_item(it));
    }
    for (name, on) in &state.cats {
        if *on {
            t.add(of_category(name));
        }
    }
    t
}

fn allowed(state: &State) -> Targets {
    let mut t = Targets::default();
    for it in state.items.iter().filter(|i| i.g == "allow") {
        t.add(of_item(it));
    }
    t
}

fn is_everything(names: &[String]) -> bool {
    names.iter().any(|n| matches!(n.trim().to_lowercase().as_str(), "*" | "all" | "everything" | "всё" | "все"))
}

pub fn limit_targets(state: &State, l: &Limit) -> Targets {
    resolve_name(state, &l.name, &l.scope)
}

/// Which usage keys have a limit "per hour": only those are counted by the hour.
pub fn hour_keys(state: &State) -> Vec<String> {
    let mut v: Vec<String> = Vec::new();
    for l in state.limits.iter().filter(|l| l.on && l.per == "hour" && l.kind == "time") {
        v.extend(limit_targets(state, l).keys());
    }
    v.sort();
    v.dedup();
    v
}

/// The key under which a foreground thing is counted: "site:www.m.youtube.com" -> "site:youtube.com" when a limit mentions youtube.com;
/// the most specific address a limit mentions wins.
pub fn canonical_key(state: &State, raw: &str) -> String {
    let raw = raw.trim().to_lowercase();
    if let Some(host) = raw.strip_prefix("site:") {
        let host = host.trim_start_matches("www.");
        let mut best: Option<String> = None;
        for l in state.limits.iter().filter(|l| l.on) {
            for d in limit_targets(state, l).domains {
                if same_or_under(host, &d) && best.as_ref().map(|b| d.len() > b.len()).unwrap_or(true) {
                    best = Some(d);
                }
            }
        }
        return format!("site:{}", best.unwrap_or_else(|| host.to_string()));
    }
    raw
}

fn used(usage: &Usage, now: &Now, l: &Limit, t: &Targets) -> u32 {
    let keys = t.keys();
    match l.kind.as_str() {
        "open" => keys.iter().map(|k| usage.opens(k, &l.per, now)).sum(),
        _ => keys.iter().map(|k| usage.secs(k, &l.per, now)).sum(),
    }
}

pub fn limit_exceeded(state: &State, usage: &Usage, now: &Now, l: &Limit) -> bool {
    if !l.on {
        return false;
    }
    let t = limit_targets(state, l);
    if t.is_empty() {
        return false;
    }
    match l.kind.as_str() {
        "cool" => t.keys().iter().any(|k| usage.cool_until.get(k).map(|u| *u > now.ms).unwrap_or(false)),
        "open" => used(usage, now, l, &t) >= l.amount,
        _ => used(usage, now, l, &t) >= l.amount.saturating_mul(60),
    }
}

/// Starts the closed spell for things used continuously for too long. Call after every tick.
pub fn apply_cools(usage: &mut Usage, state: &State, now: &Now) {
    for l in state.limits.iter().filter(|l| l.on && l.kind == "cool") {
        for k in limit_targets(state, l).keys() {
            if usage.run.get(&k).copied().unwrap_or(0) >= l.amount.saturating_mul(60) && l.amount > 0 {
                usage.cool_until.insert(k.clone(), now.ms + l.cool as i64 * 60_000);
                usage.run.remove(&k);
            }
        }
    }
}

pub fn decide(state: &State, now: &Now, usage: &Usage, session: Option<&Session>, grants: &Grants) -> Decision {
    let mut block = Targets::default();
    let mut d = Decision::default();
    let mut allow_only = false;
    let dis = distracting(state);

    // scheduled rules
    for r in state.rules.iter().filter(|r| r.on && r.kind == "schedule") {
        let Some(mins) = active_for(r, now) else { continue };
        let hard = r.level >= 2;
        if !hard && (grants.covers(&r.id, now.ms) || (r.breaks && grants.all(now.ms))) {
            continue;
        }
        match r.block.as_str() {
            "all" => allow_only = true,
            _ => block.add(dis.clone()),
        }
        d.level = d.level.max(r.level.min(3));
        d.reasons.push(Reason { kind: "rule".into(), name: r.name.clone(), mins_left: Some(mins) });
    }

    // the focus session
    if let Some(s) = session {
        if s.ends_at_ms > now.ms {
            let hard = s.level >= 2;
            let on_break = !hard && s.allow_breaks && s.snooze_until_ms.map(|u| u > now.ms).unwrap_or(false);
            if !on_break && !grants.covers(&s.id, now.ms) {
                if s.blocks.is_empty() {
                    block.add(dis.clone());
                } else if is_everything(&s.blocks) {
                    allow_only = true;
                } else {
                    for n in &s.blocks {
                        block.add(resolve_name(state, n, ""));
                    }
                }
                d.level = d.level.max(s.level.min(3));
                d.reasons.push(Reason { kind: "session".into(), name: s.name.clone(), mins_left: Some(((s.ends_at_ms - now.ms) / 60_000 + 1) as u32) });
            }
        }
    }

    // limits
    for l in state.limits.iter().filter(|l| l.on) {
        if !limit_exceeded(state, usage, now, l) || grants.covers(&l.id, now.ms) || grants.all(now.ms) {
            continue;
        }
        let t = limit_targets(state, l);
        match l.act.as_str() {
            "warn" => d.warn.push(l.name.clone()),
            "delay" => d.delay.extend(t.domains.iter().cloned()),
            _ => {
                block.add(t);
                d.reasons.push(Reason { kind: if l.kind == "cool" { "cool".into() } else { "limit".into() }, name: l.name.clone(), mins_left: None });
            }
        }
    }

    let anything = allow_only || !block.is_empty();
    let tam = &state.protect.tam;
    let frozen = d.level >= 3 && anything;

    // always-allowed things win, except in a frozen session
    if !frozen {
        let ok = allowed(state);
        for x in &ok.domains {
            block.domains.remove(x);
        }
        for x in &ok.exes {
            block.exes.remove(x);
        }
    }
    // exceptions: an address (no path) is taken out of the list; one with a path stays for the extension to decide
    if !frozen {
        for e in &state.exceptions {
            let e = e.trim().to_lowercase();
            if !e.contains('/') {
                block.domains.remove(&e);
                block.domains.remove(e.trim_start_matches("www."));
            }
        }
        d.exceptions = state.exceptions.iter().map(|e| e.trim().to_lowercase()).filter(|e| !e.is_empty()).collect();
    }

    d.allow_only = allow_only || frozen;
    if d.allow_only && !frozen {
        let ok = allowed(state);
        d.allow_domains = ok.domains.into_iter().collect();
        d.allow_exes = ok.exes.into_iter().collect();
        for e in &state.exceptions {
            let e = e.trim().to_lowercase();
            if !e.contains('/') && !e.is_empty() {
                d.allow_domains.push(e);
            }
        }
    }
    d.domains = block.domains.into_iter().filter(|x| crate::hosts::valid_domain(x)).collect();
    d.exes = block.exes.into_iter().collect();
    if anything {
        d.keywords = state.keywords.iter().map(|k| k.trim().to_lowercase()).filter(|k| !k.is_empty()).collect();
    }
    d.close_private = anything && tam.private && (d.level >= 1 || frozen);
    d.block_vpn = anything && tam.vpn && (d.level >= 1 || frozen);
    d.lock_taskmgr = anything && d.level >= 2 && (tam.taskmgr || frozen);
    d.close_tools = frozen;
    d.keep_awake = anything && d.level >= 2 && tam.sleep;
    if !anything {
        d.level = 0;
    }
    d
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Limit, Rule};

    fn now(weekday: u8, minute: u16) -> Now {
        Now { ms: 1_000_000, weekday, minute, day: "2026-11-04".into() }
    }
    fn site(name: &str, g: &str) -> Item {
        Item { name: name.into(), kind: "site".into(), g: g.into(), ..Default::default() }
    }
    fn state() -> State {
        State { items: vec![site("YouTube", "dis"), site("docs.google.com", "allow"), Item { name: "Steam".into(), kind: "app".into(), g: "dis".into(), ..Default::default() }], ..Default::default() }
    }

    #[test]
    fn quiet_when_nothing_is_running() {
        let d = decide(&state(), &now(2, 600), &Usage::default(), None, &Grants::default());
        assert!(!d.active());
        assert_eq!(d.level, 0);
    }

    #[test]
    fn a_schedule_closes_the_distracting_list() {
        let mut s = state();
        s.rules.push(Rule { id: "r1".into(), name: "Work".into(), level: 2, ..Default::default() });
        let d = decide(&s, &now(2, 600), &Usage::default(), None, &Grants::default());
        assert!(d.domains.contains(&"youtube.com".to_string()));
        assert!(d.exes.contains(&"steam.exe".to_string()));
        assert!(d.locked());
        assert_eq!(d.reasons[0].name, "Work");
        // out of hours it is quiet
        let d = decide(&s, &now(2, 1100), &Usage::default(), None, &Grants::default());
        assert!(!d.active());
    }

    #[test]
    fn grants_lift_soft_rules_but_not_locked_ones() {
        let mut s = state();
        s.rules.push(Rule { id: "soft".into(), name: "Soft".into(), level: 1, ..Default::default() });
        let mut g = Grants::default();
        g.ids.insert("soft".into(), 2_000_000);
        assert!(!decide(&s, &now(2, 600), &Usage::default(), None, &g).active());
        s.rules[0].level = 2;
        assert!(decide(&s, &now(2, 600), &Usage::default(), None, &g).active());
        let all = Grants { all_until_ms: 2_000_000, ..Default::default() };
        assert!(decide(&s, &now(2, 600), &Usage::default(), None, &all).active());
        s.rules[0].level = 1;
        assert!(!decide(&s, &now(2, 600), &Usage::default(), None, &all).active());
    }

    #[test]
    fn session_blocks_only_what_was_chosen_and_breaks_work() {
        let s = state();
        let mut ses = Session { id: "s".into(), name: "Deep".into(), ends_at_ms: 5_000_000, level: 1, blocks: vec!["YouTube".into()], allow_breaks: true, ..Default::default() };
        let d = decide(&s, &now(5, 600), &Usage::default(), Some(&ses), &Grants::default());
        assert_eq!(d.exes, Vec::<String>::new());
        assert!(d.domains.contains(&"youtu.be".to_string()));
        ses.snooze_until_ms = Some(1_500_000);
        assert!(!decide(&s, &now(5, 600), &Usage::default(), Some(&ses), &Grants::default()).active());
        ses.level = 2; // locked sessions have no breaks
        assert!(decide(&s, &now(5, 600), &Usage::default(), Some(&ses), &Grants::default()).active());
        ses.ends_at_ms = 900_000; // over
        assert!(!decide(&s, &now(5, 600), &Usage::default(), Some(&ses), &Grants::default()).active());
    }

    #[test]
    fn everything_but_the_allowed_list() {
        let s = state();
        let ses = Session { id: "s".into(), name: "All".into(), ends_at_ms: 5_000_000, blocks: vec!["Everything".into()], ..Default::default() };
        let d = decide(&s, &now(5, 600), &Usage::default(), Some(&ses), &Grants::default());
        assert!(d.allow_only);
        assert!(!d.blocks_host("docs.google.com"));
        assert!(d.blocks_host("news.ycombinator.com"));
        assert!(d.blocks_exe("game.exe"));
        assert!(!d.blocks_exe("explorer.exe")); // the system is never touched
    }

    #[test]
    fn frozen_ignores_the_allowed_list_and_turns_everything_on() {
        let s = state();
        let ses = Session { id: "s".into(), name: "Frozen".into(), ends_at_ms: 5_000_000, level: 3, ..Default::default() };
        let d = decide(&s, &now(5, 600), &Usage::default(), Some(&ses), &Grants::default());
        assert!(d.frozen() && d.allow_only && d.close_tools && d.lock_taskmgr && d.close_private && d.block_vpn);
        assert!(d.blocks_host("docs.google.com"));
    }

    #[test]
    fn exceptions_and_allowed_items_come_out_of_the_list() {
        let mut s = state();
        s.items.push(site("reddit.com", "dis"));
        s.items.push(site("old.reddit.com", "dis"));
        s.exceptions = vec!["old.reddit.com".into(), "youtube.com/watch?v=abc".into()];
        s.rules.push(Rule { id: "r".into(), ..Default::default() });
        let d = decide(&s, &now(2, 600), &Usage::default(), None, &Grants::default());
        assert!(d.domains.contains(&"reddit.com".to_string()));
        assert!(!d.domains.contains(&"old.reddit.com".to_string()));
        assert!(d.exceptions.contains(&"youtube.com/watch?v=abc".to_string()));
        assert!(!d.blocks_host("old.reddit.com"));
    }

    #[test]
    fn time_limit_closes_after_the_minutes_are_used() {
        let mut s = state();
        s.limits.push(Limit { id: "l".into(), name: "YouTube".into(), scope: "site".into(), amount: 10, ..Default::default() });
        let mut u = Usage::default();
        let n = now(2, 600);
        u.tick(&n, Some("site:youtube.com"), 599, &[]);
        assert!(!decide(&s, &n, &u, None, &Grants::default()).active());
        u.tick(&n, Some("site:youtube.com"), 1, &[]);
        let d = decide(&s, &n, &u, None, &Grants::default());
        assert!(d.domains.contains(&"youtube.com".to_string()));
        assert_eq!(d.reasons[0].kind, "limit");
        // a break lifts it
        let mut g = Grants::default();
        g.ids.insert("l".into(), 9_999_999);
        assert!(!decide(&s, &n, &u, None, &g).active());
    }

    #[test]
    fn warn_and_delay_do_not_close() {
        let mut s = state();
        s.limits.push(Limit { id: "l".into(), name: "YouTube".into(), amount: 1, act: "warn".into(), ..Default::default() });
        let mut u = Usage::default();
        u.tick(&now(2, 600), Some("site:youtube.com"), 120, &[]);
        let d = decide(&s, &now(2, 600), &u, None, &Grants::default());
        assert!(!d.active());
        assert_eq!(d.warn, vec!["YouTube".to_string()]);
        s.limits[0].act = "delay".into();
        assert!(decide(&s, &now(2, 600), &u, None, &Grants::default()).delay.contains(&"youtube.com".to_string()));
    }

    #[test]
    fn hourly_limit_resets_with_the_hour() {
        let mut s = state();
        s.limits.push(Limit { id: "l".into(), name: "Steam".into(), scope: "app".into(), amount: 5, per: "hour".into(), ..Default::default() });
        let keys = hour_keys(&s);
        assert!(keys.contains(&"exe:steam.exe".to_string()));
        let mut u = Usage::default();
        u.tick(&now(2, 600), Some("exe:steam.exe"), 300, &keys);
        assert!(decide(&s, &now(2, 630), &u, None, &Grants::default()).exes.contains(&"steam.exe".to_string()));
        assert!(!decide(&s, &now(2, 660), &u, None, &Grants::default()).active());
    }

    #[test]
    fn launches_limit_counts_opens() {
        let mut s = state();
        s.limits.push(Limit { id: "l".into(), name: "Steam".into(), scope: "app".into(), kind: "open".into(), amount: 2, ..Default::default() });
        let mut u = Usage::default();
        let n = now(2, 600);
        for (i, k) in ["exe:steam.exe", "exe:other.exe", "exe:steam.exe", "exe:other.exe"].iter().enumerate() {
            u.tick(&Now { ms: i as i64, ..n.clone() }, Some(k), 5, &[]);
        }
        assert!(decide(&s, &n, &u, None, &Grants::default()).exes.contains(&"steam.exe".to_string()));
    }

    #[test]
    fn continuous_use_starts_a_closed_spell() {
        let mut s = state();
        s.limits.push(Limit { id: "l".into(), name: "Steam".into(), scope: "app".into(), kind: "cool".into(), amount: 30, cool: 10, ..Default::default() });
        let mut u = Usage::default();
        let n = now(2, 600);
        u.tick(&n, Some("exe:steam.exe"), 1800, &[]);
        assert!(!decide(&s, &n, &u, None, &Grants::default()).active());
        apply_cools(&mut u, &s, &n);
        assert!(decide(&s, &n, &u, None, &Grants::default()).exes.contains(&"steam.exe".to_string()));
        let later = Now { ms: n.ms + 11 * 60_000, ..n.clone() };
        u.tick(&later, None, 1, &[]);
        assert!(!decide(&s, &later, &u, None, &Grants::default()).active());
    }

    #[test]
    fn canonical_keys_follow_the_most_specific_limit() {
        let mut s = state();
        s.limits.push(Limit { id: "l".into(), name: "youtube.com".into(), ..Default::default() });
        assert_eq!(canonical_key(&s, "site:www.youtube.com"), "site:youtube.com");
        assert_eq!(canonical_key(&s, "site:m.youtube.com"), "site:youtube.com");
        assert_eq!(canonical_key(&s, "site:example.org"), "site:example.org");
        assert_eq!(canonical_key(&s, "EXE:Steam.exe"), "exe:steam.exe");
    }

    #[test]
    fn host_matching_is_by_whole_labels() {
        let d = Decision { domains: vec!["x.com".into()], ..Default::default() };
        assert!(d.blocks_host("x.com"));
        assert!(d.blocks_host("www.x.com"));
        assert!(d.blocks_host("api.x.com"));
        assert!(!d.blocks_host("max.com"));
        assert!(!d.blocks_host("notx.com"));
    }

    #[test]
    fn keywords_and_tamper_switches_follow_the_level() {
        let mut s = state();
        s.keywords = vec!["Casino".into()];
        s.rules.push(Rule { id: "r".into(), level: 1, ..Default::default() });
        let d = decide(&s, &now(2, 600), &Usage::default(), None, &Grants::default());
        assert_eq!(d.keywords, vec!["casino".to_string()]);
        assert!(d.close_private && d.block_vpn && !d.lock_taskmgr);
        s.rules[0].level = 0;
        let d = decide(&s, &now(2, 600), &Usage::default(), None, &Grants::default());
        assert!(!d.close_private && !d.block_vpn);
    }
}
