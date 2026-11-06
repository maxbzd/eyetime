//! How long each program or site was in front, today, this hour, this week. This is what the limits are measured against, and what the
//! Insights screen shows. Everything stays on this computer.

use crate::model::Now;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct DayUsage {
    /// seconds in front, by key ("exe:steam.exe", "site:youtube.com")
    pub secs: BTreeMap<String, u32>,
    /// launches (the key came to the front after something else was there for a while)
    pub opens: BTreeMap<String, u32>,
    /// seconds by hour of the day, summed over every key
    pub hours: Vec<u32>,
    /// seconds by hour and key, only for the keys that have a limit by the hour
    pub hour_keys: BTreeMap<String, Vec<u32>>,
    pub switches: u32,
    pub offline_secs: u32,
    /// seconds on things from the distracting list (the whole day, and by hour)
    pub dis_secs: u32,
    pub dis_hours: Vec<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct Usage {
    pub days: BTreeMap<String, DayUsage>,
    /// key -> ms until which the thing stays closed after a spell of continuous use
    pub cool_until: BTreeMap<String, i64>,
    /// key -> seconds of continuous use so far
    pub run: BTreeMap<String, u32>,
    pub last_key: Option<String>,
    pub last_seen_ms: i64,
}

impl Usage {
    fn day_mut(&mut self, day: &str) -> &mut DayUsage {
        let d = self.days.entry(day.to_string()).or_default();
        if d.hours.len() != 24 {
            d.hours = vec![0; 24];
        }
        if d.dis_hours.len() != 24 {
            d.dis_hours = vec![0; 24];
        }
        d
    }

    /// `key` was in front for `dt` seconds. `None` means nothing was (the person was away, or the desktop was).
    pub fn tick(&mut self, now: &Now, key: Option<&str>, dt: u32, track_hours_for: &[String]) {
        let h = now.hour() as usize;
        self.last_seen_ms = now.ms;
        match key {
            Some(k) => {
                let first = self.last_key.as_deref() != Some(k);
                let had_last = self.last_key.is_some();
                let d = self.day_mut(&now.day);
                *d.secs.entry(k.to_string()).or_insert(0) += dt;
                d.hours[h] += dt;
                if first {
                    *d.opens.entry(k.to_string()).or_insert(0) += 1;
                    if had_last {
                        d.switches += 1;
                    }
                }
                if track_hours_for.iter().any(|x| x == k) {
                    d.hour_keys
                        .entry(k.to_string())
                        .or_insert_with(|| vec![0; 24])[h] += dt;
                }
                if first {
                    self.run.clear(); // continuous use is use of the same thing
                }
                *self.run.entry(k.to_string()).or_insert(0) += dt;
                self.last_key = Some(k.to_string());
            }
            None => {
                let d = self.day_mut(&now.day);
                d.offline_secs += dt;
                self.run.clear();
                self.last_key = None;
            }
        }
        // keep five weeks
        while self.days.len() > 35 {
            let first = self.days.keys().next().cloned().unwrap();
            self.days.remove(&first);
        }
        self.cool_until.retain(|_, until| *until > now.ms);
    }

    /// The thing counted by the last `tick` was a distracting one.
    pub fn mark_distracting(&mut self, now: &Now, dt: u32) {
        let h = now.hour() as usize;
        let d = self.day_mut(&now.day);
        d.dis_secs += dt;
        d.dis_hours[h] += dt;
    }

    pub fn today(&self, now: &Now) -> DayUsage {
        self.days.get(&now.day).cloned().unwrap_or_default()
    }

    /// seconds of `key` in the period
    pub fn secs(&self, key: &str, per: &str, now: &Now) -> u32 {
        match per {
            "hour" => self
                .days
                .get(&now.day)
                .and_then(|d| d.hour_keys.get(key))
                .map(|v| v[now.hour() as usize])
                .unwrap_or(0),
            "week" => self
                .days
                .iter()
                .rev()
                .take(7)
                .map(|(_, d)| d.secs.get(key).copied().unwrap_or(0))
                .sum(),
            _ => self
                .days
                .get(&now.day)
                .and_then(|d| d.secs.get(key))
                .copied()
                .unwrap_or(0),
        }
    }

    pub fn opens(&self, key: &str, per: &str, now: &Now) -> u32 {
        match per {
            "week" => self
                .days
                .iter()
                .rev()
                .take(7)
                .map(|(_, d)| d.opens.get(key).copied().unwrap_or(0))
                .sum(),
            _ => self
                .days
                .get(&now.day)
                .and_then(|d| d.opens.get(key))
                .copied()
                .unwrap_or(0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn now(ms: i64, minute: u16) -> Now {
        Now {
            ms,
            weekday: 2,
            minute,
            day: "2026-11-04".into(),
        }
    }
    #[test]
    fn counts_time_opens_and_switches() {
        let mut u = Usage::default();
        u.tick(&now(1000, 600), Some("exe:a.exe"), 5, &[]);
        u.tick(&now(2000, 600), Some("exe:a.exe"), 5, &[]);
        u.tick(&now(3000, 600), Some("exe:b.exe"), 5, &[]);
        u.tick(&now(4000, 600), Some("exe:a.exe"), 5, &[]);
        let n = now(4000, 600);
        assert_eq!(u.secs("exe:a.exe", "day", &n), 15);
        assert_eq!(u.opens("exe:a.exe", "day", &n), 2);
        assert_eq!(u.today(&n).switches, 2);
        assert_eq!(u.today(&n).hours[10], 20);
    }
    #[test]
    fn continuous_use_resets_when_something_else_comes_forward() {
        let mut u = Usage::default();
        u.tick(&now(0, 0), Some("a"), 60, &[]);
        u.tick(&now(1, 0), Some("a"), 60, &[]);
        assert_eq!(u.run["a"], 120);
        u.tick(&now(2, 0), Some("b"), 1, &[]);
        assert!(!u.run.contains_key("a"));
    }
    #[test]
    fn hour_window() {
        let mut u = Usage::default();
        u.tick(&now(0, 600), Some("a"), 30, &["a".to_string()]);
        assert_eq!(u.secs("a", "hour", &now(0, 630)), 30);
        assert_eq!(u.secs("a", "hour", &now(0, 700)), 0); // the next hour starts empty
    }
    #[test]
    fn away_counts_as_offline() {
        let mut u = Usage::default();
        u.tick(&now(0, 0), None, 100, &[]);
        assert_eq!(u.today(&now(0, 0)).offline_secs, 100);
    }
}
