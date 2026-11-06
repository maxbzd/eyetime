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
    /// after a restart: the lock continues from a known moment
    pub fn set_anchor(&mut self, anchor: i64) {
        self.anchor = Some(anchor);
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

/// Every minute of the week in which the rule is running: an overnight rule runs into the morning of the next day, a rule with the same time twice is all day
/// on its own days. Written out by ranges (this runs on every edit while a block is locked); the test `week_cover_is_what_active_for_says` checks it against
/// `active_for`, the function the engine uses, minute by minute.
fn week_cover(r: &Rule) -> Vec<bool> {
    let mut v = vec![false; 7 * 1440];
    if !r.on || r.kind == "timer" {
        return v;
    }
    let (Some(a), Some(b)) = (
        crate::schedule::parse_hm(&r.from),
        crate::schedule::parse_hm(&r.to),
    ) else {
        return v;
    };
    let (a, b) = (a as usize, b as usize);
    let mut fill =
        |day: usize, from: usize, to: usize| v[day * 1440 + from..day * 1440 + to].fill(true);
    for &d in r.days.iter().filter(|d| **d < 7) {
        let d = d as usize;
        if a == b {
            fill(d, 0, 1440);
        } else if b > a {
            fill(d, a, b);
        } else {
            fill(d, a, 1440);
            fill((d + 1) % 7, 0, b);
        }
    }
    v
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
    if a.block != b.block && b.block != "all" {
        return true;
    }
    // some minute of the week that was closed is not any more
    let (ca, cb) = (week_cover(a), week_cover(b));
    ca.iter().zip(cb.iter()).any(|(x, y)| *x && !*y)
}

fn limit_loosened(a: &Limit, b: &Limit) -> bool {
    (!b.on && a.on)
        || b.amount > a.amount && a.kind != "cool"
        || (a.kind == "cool" && (b.amount > a.amount || b.cool < a.cool))
        || b.kind != a.kind
        || b.per != a.per && period_rank(&b.per) > period_rank(&a.per)
        || act_rank(&b.act) < act_rank(&a.act)
        || b.name != a.name
        || b.scope != a.scope
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
        match new
            .items
            .iter()
            .find(|b| b.name == a.name && b.kind == a.kind)
        {
            None => out.push(format!("taken off the list: {}", a.name)),
            Some(b) if item_rank(b) < 2 => out.push(format!("no longer distracting: {}", a.name)),
            _ => {}
        }
    }
    for b in new.items.iter().filter(|i| i.g == "allow") {
        if !old
            .items
            .iter()
            .any(|a| a.name == b.name && a.kind == b.kind && a.g == "allow")
        {
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
    if friction_rank(&q.friction) < friction_rank(&p.friction)
        || (q.friction == "wait" && p.friction == "wait" && q.wait_sec < p.wait_sec)
        || (q.type_len < p.type_len && q.friction == "type")
    {
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

/// A frozen block never lasts longer than this (minutes)
pub const MAX_FROZEN_MIN: u32 = 8 * 60;

/// Can the person always get out? A locked or frozen setup needs at least one emergency key a week, and a frozen one must be short.
/// Returns the reasons the setup is refused (empty: fine). This runs inside the helper: the window cannot talk its way around it.
pub fn unsafe_setup(state: &State) -> Vec<String> {
    let mut out = Vec::new();
    let keys_ok = state.protect.emerg >= 1 && state.protect.emerg_week >= 1;
    for r in state
        .rules
        .iter()
        .filter(|r| r.on && r.kind == "schedule" && r.level >= 2)
    {
        if !keys_ok {
            out.push(format!("no_escape: {}", r.name));
        }
        if r.level >= 3 {
            let (f, t) = (
                crate::schedule::parse_hm(&r.from),
                crate::schedule::parse_hm(&r.to),
            );
            let len = match (f, t) {
                (Some(f), Some(t)) if f == t => 1440u32,
                (Some(f), Some(t)) if t > f => (t - f) as u32,
                (Some(f), Some(t)) => (1440 - f + t) as u32,
                _ => 0,
            };
            if len > MAX_FROZEN_MIN {
                out.push(format!("too_long: {}", r.name));
            }
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
    use crate::model::{Item, Now, Tamper};

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
    fn locked_setups_always_have_a_way_out() {
        let mut s = base();
        assert!(unsafe_setup(&s).is_empty());
        s.protect.emerg = 0;
        assert_eq!(unsafe_setup(&s).len(), 1);
        s.protect.emerg = 3;
        s.protect.emerg_week = 0;
        assert_eq!(unsafe_setup(&s).len(), 1);
        s.protect.emerg_week = 1;
        s.rules[0].level = 3; // 09:00-17:00 is 8 hours: fine
        assert!(unsafe_setup(&s).is_empty());
        s.rules[0].to = "17:01".into();
        assert!(unsafe_setup(&s)[0].starts_with("too_long"));
        s.rules[0].from = "00:00".into();
        s.rules[0].to = "00:00".into(); // all day
        assert!(unsafe_setup(&s)[0].starts_with("too_long"));
        s.rules[0].on = false; // a rule that is off cannot trap anyone
        assert!(unsafe_setup(&s).is_empty());
    }

    #[test]
    fn boot_never_goes_back() {
        assert_eq!(boot_time(100, 500), 500);
        assert_eq!(boot_time(900, 500), 900);
    }

    fn base() -> State {
        State {
            rules: vec![Rule {
                id: "r".into(),
                name: "Work".into(),
                level: 2,
                breaks: false,
                ..Default::default()
            }],
            limits: vec![Limit {
                id: "l".into(),
                name: "YouTube".into(),
                amount: 30,
                ..Default::default()
            }],
            items: vec![Item {
                name: "YouTube".into(),
                kind: "site".into(),
                g: "dis".into(),
                ..Default::default()
            }],
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
        b.items.push(Item {
            name: "Reddit".into(),
            kind: "site".into(),
            g: "dis".into(),
            ..Default::default()
        });
        b.protect.level = 1;
        b.rules.push(Rule {
            id: "new".into(),
            ..Default::default()
        });
        b.rules[0].days = vec![0, 1, 2, 3, 4, 5];
        b.rules[0].from = "08:00".into();
        assert_eq!(loosens(&a, &b), Vec::<String>::new());
    }

    #[test]
    fn every_way_out_is_caught() {
        let a = base();
        type Edit = Box<dyn Fn(&mut State)>;
        let cases: Vec<(&str, Edit)> = vec![
            ("remove rule", Box::new(|s| s.rules.clear())),
            ("rule off", Box::new(|s| s.rules[0].on = false)),
            (
                "shorter window",
                Box::new(|s| s.rules[0].to = "12:00".into()),
            ),
            (
                "later start",
                Box::new(|s| s.rules[0].from = "10:00".into()),
            ),
            ("fewer days", Box::new(|s| s.rules[0].days = vec![0])),
            ("lower level", Box::new(|s| s.rules[0].level = 0)),
            ("breaks on", Box::new(|s| s.rules[0].breaks = true)),
            ("limit longer", Box::new(|s| s.limits[0].amount = 90)),
            ("limit removed", Box::new(|s| s.limits.clear())),
            (
                "limit only warns",
                Box::new(|s| s.limits[0].act = "warn".into()),
            ),
            (
                "limit retargeted",
                Box::new(|s| s.limits[0].name = "Other".into()),
            ),
            (
                "limit period widened",
                Box::new(|s| s.limits[0].per = "week".into()),
            ),
            ("item removed", Box::new(|s| s.items.clear())),
            ("item neutral", Box::new(|s| s.items[0].g = "neu".into())),
            (
                "item allowed",
                Box::new(|s| {
                    s.items.push(Item {
                        name: "Z".into(),
                        kind: "site".into(),
                        g: "allow".into(),
                        ..Default::default()
                    })
                }),
            ),
            ("word removed", Box::new(|s| s.keywords.clear())),
            (
                "exception added",
                Box::new(|s| s.exceptions.push("youtube.com".into())),
            ),
            (
                "friction weaker",
                Box::new(|s| s.protect.friction = "none".into()),
            ),
            (
                "tamper guard off",
                Box::new(|s| {
                    s.protect.tam = Tamper {
                        hosts: false,
                        ..Default::default()
                    }
                }),
            ),
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

    // ---- the promise of "Locked": an edit that `loosens` lets through never lets less through the block ----

    struct Gen(u64);
    impl Gen {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
        fn below(&mut self, n: u64) -> u64 {
            self.next() % n
        }
    }

    fn random_rule(g: &mut Gen, id: &str) -> Rule {
        // times that make the interesting cases: ordinary, overnight, the same twice (all day), the edges of the day
        const T: [&str; 8] = [
            "00:00", "06:00", "09:00", "12:00", "17:00", "22:00", "23:59", "bad",
        ];
        let mut days = Vec::new();
        for d in 0..7u8 {
            if g.below(2) == 0 {
                days.push(d);
            }
        }
        Rule {
            id: id.into(),
            name: id.into(),
            kind: if g.below(10) == 0 {
                "timer".into()
            } else {
                "schedule".into()
            },
            from: T[g.below(T.len() as u64) as usize].into(),
            to: T[g.below(T.len() as u64) as usize].into(),
            days,
            block: ["dis", "all", "pick"][g.below(3) as usize].into(),
            breaks: g.below(2) == 0,
            on: g.below(5) != 0,
            glyph: "cal".into(),
            level: g.below(4) as u8,
            dur: 5 + g.below(120) as u32,
        }
    }

    fn at(weekday: u8, minute: u16) -> Now {
        Now {
            ms: 0,
            weekday,
            minute,
            day: "2026-11-02".into(),
        }
    }

    /// what a rule closes at a moment, as the engine sees it: (running, the hardest level, closes everything but the allowed list)
    fn effect(r: &Rule, now: &Now) -> (bool, u8, bool) {
        let state = State {
            rules: vec![r.clone()],
            ..Default::default()
        };
        let d = crate::engine::decide(
            &state,
            now,
            &crate::usage::Usage::default(),
            None,
            &crate::engine::Grants::default(),
        );
        (!d.reasons.is_empty(), d.level, d.allow_only)
    }

    #[test]
    fn an_edit_that_loosens_nothing_never_closes_less_at_any_moment_of_the_week() {
        let mut g = Gen(0x2545_F491_4F6C_DD1D);
        let (mut pairs, mut checked_pairs) = (0u32, 0u32);
        for _ in 0..40_000 {
            let a = random_rule(&mut g, "r");
            // half of the time b is a small change of a (one field), half of the time a different rule: the first is where mistakes hide
            let mut b = if g.below(2) == 0 {
                random_rule(&mut g, "r")
            } else {
                a.clone()
            };
            if g.below(2) == 0 {
                let other = random_rule(&mut g, "r");
                match g.below(7) {
                    0 => b.from = other.from,
                    1 => b.to = other.to,
                    2 => b.days = other.days,
                    3 => b.level = other.level,
                    4 => b.block = other.block,
                    5 => b.breaks = other.breaks,
                    _ => b.on = other.on,
                }
            }
            pairs += 1;
            let old = State {
                rules: vec![a.clone()],
                ..Default::default()
            };
            let new = State {
                rules: vec![b.clone()],
                ..Default::default()
            };
            if !loosens(&old, &new).is_empty() {
                continue; // refused while locked: nothing to prove
            }
            checked_pairs += 1;
            // the moments: the edges of both rules on every day, and a spread of others
            let mut minutes: Vec<u16> = vec![0, 1, 719, 720, 1438, 1439];
            for r in [&a, &b] {
                for t in [&r.from, &r.to] {
                    if let Some(m) = crate::schedule::parse_hm(t) {
                        minutes.extend([m.saturating_sub(1), m, (m + 1).min(1439)]);
                    }
                }
            }
            for _ in 0..8 {
                minutes.push(g.below(1440) as u16);
            }
            for day in 0..7u8 {
                for &m in &minutes {
                    let (ra, la, aa) = effect(&a, &at(day, m));
                    let (rb, lb, ab) = effect(&b, &at(day, m));
                    assert!(
                        !ra || rb,
                        "the new rule is not running at day {day} minute {m} where the old one was:\n old {a:?}\n new {b:?}"
                    );
                    assert!(
                        !ra || lb >= la,
                        "the level fell at day {day} minute {m}:\n old {a:?}\n new {b:?}"
                    );
                    assert!(
                        !(ra && aa) || ab,
                        "the old rule closed everything but the allowed list at day {day} minute {m}, the new one does not:\n old {a:?}\n new {b:?}"
                    );
                }
            }
        }
        // the test must really have tested something
        assert!(
            checked_pairs > 2_000,
            "only {checked_pairs} of {pairs} edits were allowed: the generator is too wild to prove anything"
        );
    }

    #[test]
    fn week_cover_is_what_active_for_says() {
        let mut g = Gen(0x9E37_79B9_7F4A_7C15);
        for _ in 0..400 {
            let r = random_rule(&mut g, "r");
            let cover = super::week_cover(&r);
            for day in 0..7u8 {
                for minute in 0..1440u16 {
                    assert_eq!(
                        cover[day as usize * 1440 + minute as usize],
                        crate::schedule::active_for(&r, &at(day, minute)).is_some(),
                        "{r:?} day {day} minute {minute}"
                    );
                }
            }
        }
    }

    #[test]
    fn turning_an_overnight_rule_into_an_all_day_one_on_the_same_days_is_refused() {
        // found by the test above: the old check compared times of day and the list of days apart, and let this through (it opens Tuesday 00:00-09:00)
        let rule = |from: &str, to: &str| Rule {
            id: "r".into(),
            from: from.into(),
            to: to.into(),
            days: vec![0, 2, 3],
            block: "all".into(),
            level: 2,
            ..Default::default()
        };
        let (old, new) = (
            State {
                rules: vec![rule("17:00", "09:00")],
                ..Default::default()
            },
            State {
                rules: vec![rule("09:00", "09:00")],
                ..Default::default()
            },
        );
        assert!(!loosens(&old, &new).is_empty());
        assert!(
            loosens(&new, &old)
                .iter()
                .all(|m| !m.contains("rule weakened"))
                || !loosens(&new, &old).is_empty()
        );
    }
}
