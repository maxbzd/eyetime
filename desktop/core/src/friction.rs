//! The small obstacles in front of "let me out": waiting, typing a long text, doing a sum, holding, a PIN, a friend's code.
//! The helper makes the challenge and checks the answer itself, so the window cannot talk its way past it.

use crate::model::Protect;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// small deterministic generator, the caller brings the seed (time, process id, whatever is unpredictable on its side)
pub struct Rng(u64);
impl Rng {
    pub fn new(seed: u64) -> Rng {
        Rng(seed ^ 0x9E37_79B9_7F4A_7C15)
    }
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    pub fn below(&mut self, n: u64) -> u64 {
        self.next() % n.max(1)
    }
}

/// What the person has to do. The public half goes to the window; the answer never leaves the helper.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Challenge {
    pub id: String,
    /// "none" | "hold" | "wait" | "type" | "math" | "pin" | "friend"
    pub kind: String,
    /// what the action is for: "end_session" | "break" | "unblock" | "edit" | "emergency" | "uninstall"
    pub action: String,
    pub prompt: String,
    pub issued_ms: i64,
    /// the answer is accepted no sooner than this
    pub ready_ms: i64,
    pub expires_ms: i64,
    #[serde(skip)]
    pub answer: String,
    /// the PIN is asked for on top of the challenge
    pub needs_pin: bool,
}

#[derive(Debug, PartialEq, Clone)]
pub enum Verdict {
    Ok,
    TooEarly(i64),
    Wrong,
    Expired,
}

const WORDS: &[&str] = &[
    "quiet", "river", "amber", "window", "garden", "pencil", "morning", "copper", "ladder", "meadow", "candle", "harbor", "violet", "pocket", "orchard", "silver", "thunder", "marble", "feather", "compass", "lantern", "velvet", "island", "canyon", "whisper", "bridge",
    "falcon", "ember", "willow", "prairie", "cactus", "ribbon", "summit", "saffron", "tundra", "cobalt", "glacier", "maple", "pebble", "horizon",
];

fn text_of(len: u8, rng: &mut Rng) -> String {
    let words = match len {
        0 | 1 => 6,
        2 => 12,
        _ => 20,
    };
    (0..words).map(|_| WORDS[rng.below(WORDS.len() as u64) as usize]).collect::<Vec<_>>().join(" ")
}

impl Challenge {
    /// `unblocks_today` makes the waiting longer each time when "grow" is on.
    pub fn new(p: &Protect, action: &str, now_ms: i64, seed: u64, unblocks_today: u32) -> Challenge {
        let mut rng = Rng::new(seed);
        let id = format!("{:016x}", rng.next());
        let mut c = Challenge { id, kind: p.friction.clone(), action: action.to_string(), prompt: String::new(), issued_ms: now_ms, ready_ms: now_ms, expires_ms: now_ms + 10 * 60_000, answer: String::new(), needs_pin: p.pin_on };
        match p.friction.as_str() {
            "hold" => {
                c.ready_ms = now_ms + 2_500;
                c.prompt = "Hold".into();
            }
            "wait" => {
                let mult = if p.grow { 1 + unblocks_today.min(5) as i64 } else { 1 };
                let secs = (p.wait_sec.max(5) as i64 * mult).min(600);
                c.ready_ms = now_ms + secs * 1000;
                c.expires_ms = c.ready_ms + 5 * 60_000;
                c.prompt = format!("{secs}");
            }
            "type" => {
                c.answer = text_of(p.type_len, &mut rng);
                c.prompt = c.answer.clone();
                c.ready_ms = now_ms + 3_000;
            }
            "math" => {
                let (a, b) = (12 + rng.below(78), 12 + rng.below(78));
                let (c1, d1) = (3 + rng.below(9), 3 + rng.below(9));
                c.answer = (a * b + c1 * d1).to_string();
                c.prompt = format!("{a} × {b} + {c1} × {d1}");
                c.ready_ms = now_ms + 3_000;
            }
            "friend" => {
                c.kind = "friend".into();
                c.prompt = "Ask your partner for the code".into();
                c.needs_pin = false;
            }
            _ => {
                c.kind = "none".into();
            }
        }
        c
    }

    pub fn public(&self) -> Challenge {
        Challenge { answer: String::new(), ..self.clone() }
    }

    /// The answer to a "type", "math" or "hold" challenge. PIN and friend codes are checked separately against the stored hashes.
    pub fn check(&self, answer: &str, now_ms: i64) -> Verdict {
        if now_ms > self.expires_ms {
            return Verdict::Expired;
        }
        if now_ms < self.ready_ms {
            return Verdict::TooEarly(self.ready_ms - now_ms);
        }
        match self.kind.as_str() {
            "type" | "math" => {
                if answer.trim() == self.answer {
                    Verdict::Ok
                } else {
                    Verdict::Wrong
                }
            }
            "friend" => Verdict::Ok, // the code is verified by the caller
            _ => Verdict::Ok,
        }
    }
}

/// A PIN kept as a salted hash. Wrong tries lock it for a while, and the wait doubles.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Pin {
    pub salt: String,
    pub hash: String,
    pub fails: u32,
    pub locked_until_ms: i64,
}

fn hash_pin(salt: &str, pin: &str) -> String {
    let mut h = Sha256::new();
    h.update(b"eyetime-pin-v1");
    h.update(salt.as_bytes());
    h.update(pin.as_bytes());
    // stretch a little; the lockout is the real defence
    let mut d = h.finalize_reset();
    for _ in 0..20_000 {
        h.update(d);
        h.update(salt.as_bytes());
        d = h.finalize_reset();
    }
    d.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Debug, PartialEq)]
pub enum PinResult {
    Ok,
    Wrong { fails: u32, locked_for_ms: i64 },
    Locked(i64),
    NotSet,
}

impl Pin {
    pub fn is_set(&self) -> bool {
        !self.hash.is_empty()
    }
    pub fn valid_format(pin: &str) -> bool {
        (4..=12).contains(&pin.len()) && pin.bytes().all(|b| b.is_ascii_digit())
    }
    pub fn set(pin: &str, seed: u64) -> Option<Pin> {
        if !Pin::valid_format(pin) {
            return None;
        }
        let salt = format!("{:016x}", Rng::new(seed).next());
        Some(Pin { hash: hash_pin(&salt, pin), salt, fails: 0, locked_until_ms: 0 })
    }
    pub fn verify(&mut self, pin: &str, now_ms: i64) -> PinResult {
        if !self.is_set() {
            return PinResult::NotSet;
        }
        if self.locked_until_ms > now_ms {
            return PinResult::Locked(self.locked_until_ms - now_ms);
        }
        if constant_eq(&hash_pin(&self.salt, pin), &self.hash) {
            self.fails = 0;
            return PinResult::Ok;
        }
        self.fails += 1;
        // three free tries, then 30 s, 60 s, 2 min ... up to an hour
        let lock = if self.fails >= 3 { (30_000i64 << (self.fails - 3).min(7)).min(3_600_000) } else { 0 };
        self.locked_until_ms = now_ms + lock;
        PinResult::Wrong { fails: self.fails, locked_for_ms: lock }
    }
}

fn constant_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Emergency keys: a few a month, fewer a week. The helper keeps the ledger, the window only sees the count.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Ledger {
    pub month: String,
    pub week: i64,
    pub used_month: u32,
    pub used_week: u32,
    /// grows with every use of the key; shown in Insights
    pub total: u32,
}

/// days since 1970-01-01 of a YYYY-MM-DD date
pub fn days_from_civil(day: &str) -> Option<i64> {
    let mut it = day.split('-');
    let (y, m, d): (i64, i64, i64) = (it.next()?.parse().ok()?, it.next()?.parse().ok()?, it.next()?.parse().ok()?);
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

impl Ledger {
    fn roll(&mut self, day: &str) {
        let month = day.get(..7).unwrap_or("").to_string();
        let week = days_from_civil(day).map(|d| (d + 3).div_euclid(7)).unwrap_or(0); // weeks begin on Monday
        if self.month != month {
            self.month = month;
            self.used_month = 0;
        }
        if self.week != week {
            self.week = week;
            self.used_week = 0;
        }
    }
    pub fn left(&mut self, p: &Protect, day: &str) -> u32 {
        self.roll(day);
        p.emerg.saturating_sub(self.used_month).min(p.emerg_week.saturating_sub(self.used_week))
    }
    pub fn spend(&mut self, p: &Protect, day: &str) -> bool {
        if self.left(p, day) == 0 {
            return false;
        }
        self.used_month += 1;
        self.used_week += 1;
        self.total += 1;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn protect(friction: &str) -> Protect {
        Protect { friction: friction.into(), ..Default::default() }
    }

    #[test]
    fn waiting_grows_with_each_unblock_and_is_capped() {
        let p = Protect { wait_sec: 30, ..protect("wait") };
        assert_eq!(Challenge::new(&p, "break", 0, 1, 0).ready_ms, 30_000);
        assert_eq!(Challenge::new(&p, "break", 0, 1, 2).ready_ms, 90_000);
        assert_eq!(Challenge::new(&p, "break", 0, 1, 50).ready_ms, 180_000);
        let p = Protect { grow: false, ..p };
        assert_eq!(Challenge::new(&p, "break", 0, 1, 4).ready_ms, 30_000);
        let p = Protect { wait_sec: 9999, grow: false, ..p };
        assert_eq!(Challenge::new(&p, "break", 0, 1, 0).ready_ms, 600_000);
    }

    #[test]
    fn typing_needs_the_exact_text_and_a_pause() {
        let p = protect("type");
        let c = Challenge::new(&p, "break", 1000, 7, 0);
        assert_eq!(c.check(&c.answer, 1500), Verdict::TooEarly(2500));
        assert_eq!(c.check("nope", 5000), Verdict::Wrong);
        assert_eq!(c.check(&format!("  {} ", c.answer), 5000), Verdict::Ok);
        assert_eq!(c.check(&c.answer, 1000 + 11 * 60_000), Verdict::Expired);
        assert!(c.public().answer.is_empty());
        let json = serde_json::to_string(&c).unwrap();
        assert!(!json.contains("\"answer\""));
    }

    #[test]
    fn the_longer_the_setting_the_longer_the_text() {
        let short = Challenge::new(&Protect { type_len: 1, ..protect("type") }, "x", 0, 3, 0);
        let long = Challenge::new(&Protect { type_len: 3, ..protect("type") }, "x", 0, 3, 0);
        assert!(long.answer.len() > short.answer.len() * 2);
    }

    #[test]
    fn math_answers_are_right() {
        let c = Challenge::new(&protect("math"), "x", 0, 99, 0);
        let nums: Vec<u64> = c.prompt.split(|ch: char| !ch.is_ascii_digit()).filter(|s| !s.is_empty()).map(|s| s.parse().unwrap()).collect();
        assert_eq!(nums[0] * nums[1] + nums[2] * nums[3], c.answer.parse::<u64>().unwrap());
        assert_eq!(c.check(&c.answer, 4000), Verdict::Ok);
    }

    #[test]
    fn different_seeds_give_different_challenges() {
        let a = Challenge::new(&protect("type"), "x", 0, 1, 0);
        let b = Challenge::new(&protect("type"), "x", 0, 2, 0);
        assert_ne!(a.id, b.id);
        assert_ne!(a.answer, b.answer);
    }

    #[test]
    fn unknown_friction_means_none() {
        assert_eq!(Challenge::new(&protect("none"), "x", 0, 1, 0).kind, "none");
        assert_eq!(Challenge::new(&protect("weird"), "x", 0, 1, 0).kind, "none");
    }

    #[test]
    fn pin_locks_after_three_wrong_tries_and_the_wait_doubles() {
        let mut p = Pin::set("1234", 5).unwrap();
        assert_ne!(p.hash, "1234");
        assert_eq!(p.verify("1234", 0), PinResult::Ok);
        assert!(matches!(p.verify("0000", 0), PinResult::Wrong { locked_for_ms: 0, .. }));
        assert!(matches!(p.verify("0000", 0), PinResult::Wrong { locked_for_ms: 0, .. }));
        assert_eq!(p.verify("0000", 0), PinResult::Wrong { fails: 3, locked_for_ms: 30_000 });
        assert_eq!(p.verify("1234", 10_000), PinResult::Locked(20_000)); // even the right one waits
        assert_eq!(p.verify("0000", 31_000), PinResult::Wrong { fails: 4, locked_for_ms: 60_000 });
        assert_eq!(p.verify("1234", 100_000), PinResult::Ok);
        assert_eq!(p.fails, 0);
    }

    #[test]
    fn pin_format_is_checked() {
        assert!(Pin::set("12", 1).is_none());
        assert!(Pin::set("12a4", 1).is_none());
        assert!(Pin::set("1234567890123", 1).is_none());
        assert_eq!(Pin::default().verify("1234", 0), PinResult::NotSet);
    }

    #[test]
    fn same_pin_different_salt() {
        assert_ne!(Pin::set("1234", 1).unwrap().hash, Pin::set("1234", 2).unwrap().hash);
    }

    #[test]
    fn emergency_keys_per_week_and_month() {
        let p = Protect { emerg: 3, emerg_week: 1, ..Default::default() };
        let mut l = Ledger::default();
        assert_eq!(l.left(&p, "2026-11-04"), 1);
        assert!(l.spend(&p, "2026-11-04"));
        assert!(!l.spend(&p, "2026-11-05")); // same week (Mon 2 Nov – Sun 8 Nov)
        assert!(l.spend(&p, "2026-11-09")); // next Monday
        assert_eq!(l.left(&p, "2026-11-16"), 1);
        assert!(l.spend(&p, "2026-11-16"));
        assert!(!l.spend(&p, "2026-11-23")); // three a month used
        assert!(l.spend(&p, "2026-12-01")); // new month
        assert_eq!(l.total, 4);
    }

    #[test]
    fn dates_to_days() {
        assert_eq!(days_from_civil("1970-01-01"), Some(0));
        assert_eq!(days_from_civil("2000-03-01"), Some(11017));
        assert_eq!(days_from_civil("nope"), None);
    }
}
