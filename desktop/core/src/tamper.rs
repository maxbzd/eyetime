//! Things people do to get around a block, and what to make of them: moving the clock, editing the settings while locked.

use crate::model::{Item, Limit, Rule, State};

/// While a locked block runs, time is measured by the machine's monotonic clock, not by the wall clock the person can change.
#[derive(Default, Debug)]
pub struct ClockGuard {
    anchor: Option<i64>,
    skew_ms: i64,
}

pub const SKEW_LIMIT_MS: i64 = 60_000;

impl ClockGuard {
    /// `wall` is the system clock, `mono` the monotonic clock (counts sleep too). Returns the time to trust.
    pub fn trusted_ms(&mut self, wall: i64, mono: i64, locked: bool) -> i64 {
        let off = wall - mono;
        if !locked {
            self.anchor = None;
            self.skew_ms = 0;
            return wall;
        }
        let a = *self.anchor.get_or_insert(off);
        self.skew_ms = off - a;
        mono + a
    }
    /// how far the wall clock has been moved since the lock began (positive: forward)
    pub fn skew_ms(&self) -> i64 {
        self.skew_ms
    }
    pub fn tampered(&self) -> bool {
        self.skew_ms.abs() > SKEW_LIMIT_MS
    }
}

/// After a restart the monotonic clock begins again; the last time we saw is the floor for the wall clock.
pub fn boot_time(wall: i64, last_seen: i64) -> i64 {
    wall.max(last_seen)
}

fn rule_loosened(a: &Rule, b: &Rule) -> bool {
    // a is the rule before, b after
    if !b.on && a.on {
        return true;
    }
    if b.kind != a.kind {
        return true;
    }
    if b.level < a.level || (b.breaks && !a.breaks) {
        return true;
    }
    if b.kind == "timer" {
        return b.dur < a.dur;
    }
    if a.days.iter().any(|d| !b.days.contains(d)) {
        return true;
    }
    if a.block != b.block && !(b.block == "all") {
        return true;
    }
    // some minute of the day that was covered is not any more
    let covered = |r: &Rule| -> Vec<bool> {
        let mut v = vec![false; 1440];
        if let (Some(f), Some(t)) = (crate::schedule::parse_hm(&r.from), crate::schedule::parse_hm(&r.to)) {
            let mut m = f as usize;
            loop {
                v[m] = true;
                m = (m + 1) % 1440;
                if m == t as usize {
                    break;
                }
            }
        }
        v
    };
    let (ca, cb) = (covered(a), covered(b));
    ca.iter().zip(cb.iter()).any(|(x, y)| *x && !*y)
}

fn limit_loosened(a: &Limit, b: &Limit) -> bool {
    (!b.on && a.on) || b.amount > a.amount && a.kind != "cool" || (a.kind == "cool" && (b.amount > a.amount || b.cool < a.cool)) || b.kind != a.kind || b.per != a.per && period_rank(&b.per) > period_rank(&a.per) || act_rank(&b.act) < act_rank(&a.act) || b.name != a.name || b.scope != a.scope
}
fn period_rank(p: &str) -> u8 {
    match p {
        "hour" => 0,
        "day" => 1,
        _ => 2,
    }
}
fn act_rank(a: &str) -> u8 {
    match a {
        "block" => 2,
        "delay" => 1,
        _ => 0,
    }
}

fn item_rank(i: &Item) -> u8 {
    match i.g.as_str() {
        "dis" => 2,
        "neu" => 1,
        _ => 0,
    }
}

/// What in `new` is weaker than in `old`. An empty answer means the edit is safe to accept while a locked block runs.
pub fn loosens(old: &State, new: &State) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for a in &old.rules {
        match new.rules.iter().find(|b| b.id == a.id) {
            None => out.push(format!("rule removed: {}", a.name)),
            Some(b) if rule_loosened(a, b) => out.push(format!("rule weakened: {}", a.name)),
            _ => {}
        }
    }
    for a in &old.limits {
        match new.limits.iter().find(|b| b.id == a.id) {
            None => out.push(format!("limit removed: {}", a.name)),
            Some(b) if limit_loosened(a, b) => out.push(format!("limit weakened: {}", a.name)),
            _ => {}
        }
    }
    for a in old.items.iter().filter(|i| item_rank(i) == 2) {
        match new.items.iter().find(|b| b.name == a.name && b.kind == a.kind) {
            None => out.push(format!("taken off the list: {}", a.name)),
            Some(b) if item_rank(b) < 2 => out.push(format!("no longer distracting: {}", a.name)),
            _ => {}
        }
    }
    for b in new.items.iter().filter(|i| i.g == "allow") {
        if !old.items.iter().any(|a| a.name == b.name && a.kind == b.kind && a.g == "allow") {
            out.push(format!("now always allowed: {}", b.name));
        }
    }
    for (k, on) in &old.cats {
        if *on && !new.cats.get(k).copied().unwrap_or(false) {
            out.push(format!("category off: {k}"));
        }
    }
    for k in &old.keywords {
        if !new.keywords.contains(k) {
            out.push(format!("word removed: {k}"));
        }
    }
    for e in &new.exceptions {
        if !old.exceptions.contains(e) {
            out.push(format!("exception added: {e}"));
        }
    }
    let (p, q) = (&old.protect, &new.protect);
    if q.level < p.level {
        out.push("protection level lowered".into());
    }
    if friction_rank(&q.friction) < friction_rank(&p.friction) || (q.friction == "wait" && p.friction == "wait" && q.wait_sec < p.wait_sec) || (q.type_len < p.type_len && q.friction == "type") {
        out.push("friction weakened".into());
    }
    if (p.pin_on && !q.pin_on) || (p.grow && !q.grow) || (p.reset_streak && !q.reset_streak) {
        out.push("protection switched off".into());
    }
    if q.emerg > p.emerg || q.emerg_week > p.emerg_week {
        out.push("more emergency keys".into());
    }
    if q.partner != p.partner && !p.partner.is_empty() {
        out.push("partner changed".into());
    }
    let (t, u) = (&p.tam, &q.tam);
    for (name, was, is) in [
        ("uninstall", t.uninstall, u.uninstall),
        ("watchdog", t.watchdog, u.watchdog),
        ("hosts", t.hosts, u.hosts),
        ("private", t.private, u.private),
        ("vpn", t.vpn, u.vpn),
        ("ext", t.ext, u.ext),
        ("clock", t.clock, u.clock),
        ("taskmgr", t.taskmgr, u.taskmgr),
        ("safemode", t.safemode, u.safemode),
    ] {
        if was && !is {
            out.push(format!("guard off: {name}"));
        }
    }
    out
}

fn friction_rank(f: &str) -> u8 {
    match f {
        "friend" => 5,
        "type" | "math" => 4,
        "wait" => 3,
        "hold" => 2,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Item, Tamper};

    #[test]
    fn moving_the_clock_forward_does_not_end_a_locked_block() {
        let mut g = ClockGuard::default();
        assert_eq!(g.trusted_ms(1_000_000, 500, true), 1_000_000);
        // an hour later by the machine, but the person put the clock a day ahead
        let wall = 1_000_000 + 3_600_000 + 86_400_000;
        let trusted = g.trusted_ms(wall, 500 + 3_600_000, true);
        assert_eq!(trusted, 1_000_000 + 3_600_000);
        assert!(g.tampered());
        assert!(g.skew_ms() > 80_000_000);
        // the same, moved back
        let trusted = g.trusted_ms(1_000_000 + 1_000, 500 + 3_600_000, true);
        assert_eq!(trusted, 1_000_000 + 3_600_000);
        assert!(g.tampered() && g.skew_ms() < 0);
    }

    #[test]
    fn small_drift_is_not_tampering_and_unlocked_follows_the_wall() {
        let mut g = ClockGuard::default();
        g.trusted_ms(10_000, 0, true);
        g.trusted_ms(10_000 + 5_000 + 2_000, 5_000, true);
        assert!(!g.tampered());
        assert_eq!(g.trusted_ms(123, 456, false), 123);
        assert!(!g.tampered());
        // a new lock takes a new anchor
        assert_eq!(g.trusted_ms(9_000_000, 1_000, true), 9_000_000);
    }

    #[test]
    fn boot_never_goes_back() {
        assert_eq!(boot_time(100, 500), 500);
        assert_eq!(boot_time(900, 500), 900);
    }

    fn base() -> State {
        State {
            rules: vec![Rule { id: "r".into(), name: "Work".into(), level: 2, breaks: false, ..Default::default() }],
            limits: vec![Limit { id: "l".into(), name: "YouTube".into(), amount: 30, ..Default::default() }],
            items: vec![Item { name: "YouTube".into(), kind: "site".into(), g: "dis".into(), ..Default::default() }],
            keywords: vec!["casino".into()],
            ..Default::default()
        }
    }

    #[test]
    fn identical_state_and_stronger_edits_are_fine() {
        let a = base();
        assert!(loosens(&a, &a).is_empty());
        let mut b = base();
        b.rules[0].to = "18:00".into();
        b.limits[0].amount = 20;
        b.keywords.push("poker".into());
        b.items.push(Item { name: "Reddit".into(), kind: "site".into(), g: "dis".into(), ..Default::default() });
        b.protect.level = 1;
        b.rules.push(Rule { id: "new".into(), ..Default::default() });
        b.rules[0].days = vec![0, 1, 2, 3, 4, 5];
        b.rules[0].from = "08:00".into();
        assert_eq!(loosens(&a, &b), Vec::<String>::new());
    }

    #[test]
    fn every_way_out_is_caught() {
        let a = base();
        let cases: Vec<(&str, Box<dyn Fn(&mut State)>)> = vec![
            ("remove rule", Box::new(|s| s.rules.clear())),
            ("rule off", Box::new(|s| s.rules[0].on = false)),
            ("shorter window", Box::new(|s| s.rules[0].to = "12:00".into())),
            ("later start", Box::new(|s| s.rules[0].from = "10:00".into())),
            ("fewer days", Box::new(|s| s.rules[0].days = vec![0])),
            ("lower level", Box::new(|s| s.rules[0].level = 0)),
            ("breaks on", Box::new(|s| s.rules[0].breaks = true)),
            ("limit longer", Box::new(|s| s.limits[0].amount = 90)),
            ("limit removed", Box::new(|s| s.limits.clear())),
            ("limit only warns", Box::new(|s| s.limits[0].act = "warn".into())),
            ("limit retargeted", Box::new(|s| s.limits[0].name = "Other".into())),
            ("limit period widened", Box::new(|s| s.limits[0].per = "week".into())),
            ("item removed", Box::new(|s| s.items.clear())),
            ("item neutral", Box::new(|s| s.items[0].g = "neu".into())),
            ("item allowed", Box::new(|s| s.items.push(Item { name: "Z".into(), kind: "site".into(), g: "allow".into(), ..Default::default() }))),
            ("word removed", Box::new(|s| s.keywords.clear())),
            ("exception added", Box::new(|s| s.exceptions.push("youtube.com".into()))),
            ("friction weaker", Box::new(|s| s.protect.friction = "none".into())),
            ("tamper guard off", Box::new(|s| s.protect.tam = Tamper { hosts: false, ..Default::default() })),
            ("more keys", Box::new(|s| s.protect.emerg = 99)),
        ];
        let mut a = a;
        a.cats.insert("Games".into(), true);
        for (name, f) in cases {
            let mut b = a.clone();
            f(&mut b);
            assert!(!loosens(&a, &b).is_empty(), "{name} was let through");
        }
        let mut b = a.clone();
        b.cats.insert("Games".into(), false);
        assert!(!loosens(&a, &b).is_empty());
    }
}
