//! When is a scheduled rule running, and when does it start next.

use crate::model::{Now, Rule};

pub fn parse_hm(s: &str) -> Option<u16> {
    let (h, m) = s.split_once(':')?;
    let (h, m): (u16, u16) = (h.trim().parse().ok()?, m.trim().parse().ok()?);
    if h < 24 && m < 60 {
        Some(h * 60 + m)
    } else {
        None
    }
}

/// If the rule is running now: minutes left until it ends. Overnight rules (23:00 to 06:00) belong to the day they start on.
pub fn active_for(rule: &Rule, now: &Now) -> Option<u32> {
    if !rule.on || rule.kind == "timer" {
        return None;
    }
    let (a, b) = (parse_hm(&rule.from)?, parse_hm(&rule.to)?);
    let cur = now.minute;
    let yesterday = (now.weekday + 6) % 7;
    if a == b {
        // the same time twice means all day, every chosen day
        return if rule.days.contains(&now.weekday) {
            Some(1440 - cur as u32)
        } else {
            None
        };
    }
    if b > a {
        return if rule.days.contains(&now.weekday) && cur >= a && cur < b {
            Some((b - cur) as u32)
        } else {
            None
        };
    }
    // overnight
    if rule.days.contains(&now.weekday) && cur >= a {
        return Some((1440 - cur + b) as u32);
    }
    if rule.days.contains(&yesterday) && cur < b {
        return Some((b - cur) as u32);
    }
    None
}

/// Minutes until the rule next starts (0 when it is running).
pub fn next_start_in(rule: &Rule, now: &Now) -> Option<u32> {
    if !rule.on || rule.kind == "timer" {
        return None;
    }
    if active_for(rule, now).is_some() {
        return Some(0);
    }
    let a = parse_hm(&rule.from)? as u32;
    for k in 0..8u32 {
        let d = ((now.weekday as u32 + k) % 7) as u8;
        if !rule.days.contains(&d) {
            continue;
        }
        let start = k * 1440 + a;
        if start > now.minute as u32 {
            return Some(start - now.minute as u32);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    fn now(weekday: u8, hm: &str) -> Now {
        Now {
            ms: 0,
            weekday,
            minute: parse_hm(hm).unwrap(),
            day: "2026-11-04".into(),
        }
    }
    fn rule(from: &str, to: &str, days: &[u8]) -> Rule {
        Rule {
            from: from.into(),
            to: to.into(),
            days: days.to_vec(),
            ..Default::default()
        }
    }
    #[test]
    fn plain_window() {
        let r = rule("09:00", "17:00", &[0, 1, 2, 3, 4]);
        assert_eq!(active_for(&r, &now(0, "09:00")), Some(480));
        assert_eq!(active_for(&r, &now(2, "16:59")), Some(1));
        assert_eq!(active_for(&r, &now(2, "17:00")), None);
        assert_eq!(active_for(&r, &now(5, "12:00")), None); // Saturday
        assert_eq!(active_for(&r, &now(0, "08:59")), None);
    }
    #[test]
    fn overnight_belongs_to_the_day_it_starts_on() {
        let r = rule("23:00", "06:00", &[4]); // Friday night
        assert_eq!(active_for(&r, &now(4, "23:30")), Some(390));
        assert_eq!(active_for(&r, &now(5, "02:00")), Some(240)); // Saturday small hours still count
        assert_eq!(active_for(&r, &now(5, "23:30")), None);
        assert_eq!(active_for(&r, &now(4, "02:00")), None);
        assert_eq!(active_for(&r, &now(0, "02:00")), None);
    }
    #[test]
    fn off_and_timer_rules_never_run_by_the_clock() {
        let mut r = rule("00:00", "23:59", &[0, 1, 2, 3, 4, 5, 6]);
        r.on = false;
        assert_eq!(active_for(&r, &now(1, "10:00")), None);
        r.on = true;
        r.kind = "timer".into();
        assert_eq!(active_for(&r, &now(1, "10:00")), None);
    }
    #[test]
    fn same_time_twice_is_all_day() {
        let r = rule("00:00", "00:00", &[6]);
        assert_eq!(active_for(&r, &now(6, "10:00")), Some(840));
        assert_eq!(active_for(&r, &now(0, "10:00")), None);
    }
    #[test]
    fn next_start() {
        let r = rule("09:00", "17:00", &[0, 1, 2, 3, 4]);
        assert_eq!(next_start_in(&r, &now(0, "08:00")), Some(60));
        assert_eq!(next_start_in(&r, &now(0, "18:00")), Some(15 * 60)); // tomorrow 09:00
        assert_eq!(next_start_in(&r, &now(4, "18:00")), Some(63 * 60)); // Friday evening to Monday 09:00
        assert_eq!(next_start_in(&r, &now(2, "10:00")), Some(0));
    }
    #[test]
    fn bad_times_are_ignored() {
        let r = rule("25:00", "17:00", &[0]);
        assert_eq!(active_for(&r, &now(0, "10:00")), None);
    }

    /// The statement shared with the browser extension (`conformance/schedule.json`, read by scripts-dev/tests/conformance.test.mjs too).
    fn schedule_vector_file() -> String {
        const TIMES: [&str; 6] = ["00:00", "06:30", "09:00", "17:00", "23:30", "12:00"];
        const MOMENTS: [u16; 13] = [
            0, 359, 360, 389, 390, 539, 540, 719, 720, 1019, 1020, 1409, 1439,
        ];
        let day_sets: [&[u8]; 7] = [
            &[],
            &[0],
            &[0, 1, 2, 3, 4],
            &[5, 6],
            &[6],
            &[0, 2, 3],
            &[0, 1, 2, 3, 4, 5, 6],
        ];
        let mut cases = Vec::new();
        for from in TIMES {
            for to in TIMES.iter().filter(|t| **t != from) {
                for days in day_sets {
                    let rule = Rule {
                        from: from.into(),
                        to: (*to).into(),
                        days: days.to_vec(),
                        ..Default::default()
                    };
                    // one bit per (weekday, moment): weekday 0 = Monday, in the order of MOMENTS
                    let bits: String = (0..7u8)
                        .flat_map(|w| MOMENTS.iter().map(move |m| (w, *m)))
                        .map(|(w, m)| {
                            let now = Now {
                                ms: 0,
                                weekday: w,
                                minute: m,
                                day: String::new(),
                            };
                            if active_for(&rule, &now).is_some() {
                                '1'
                            } else {
                                '0'
                            }
                        })
                        .collect();
                    cases.push(
                        serde_json::json!({ "from": from, "to": to, "days": days, "bits": bits }),
                    );
                }
            }
        }
        let doc = serde_json::json!({
            "about": "Is a work-hours rule running? One bit per (weekday, moment), weekday 0 = Monday, moments in the order of `moments` (minutes since midnight). Written by core/src/schedule.rs (schedule_vectors); read by the extension's tests. Rules whose times are equal are left out on purpose: the two products read them differently.",
            "moments": MOMENTS,
            "cases": cases,
        });
        serde_json::to_string_pretty(&doc).unwrap() + "\n"
    }

    #[test]
    fn schedule_vectors() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../conformance/schedule.json");
        let now = schedule_vector_file();
        if std::env::var("UPDATE_CONFORMANCE").is_ok() {
            std::fs::write(&path, &now).unwrap();
        }
        let on_disk = std::fs::read_to_string(&path)
            .expect("conformance/schedule.json is missing: run with UPDATE_CONFORMANCE=1");
        assert_eq!(
            on_disk.replace("\r\n", "\n"),
            now,
            "the vectors on disk are not what the engine says now: if the change is meant, rewrite them with UPDATE_CONFORMANCE=1 and make the extension agree"
        );
    }
}
