// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! The hosts file: one managed block, nothing else touched. Every name is checked before it is written,
//! so that nothing a person types in a list can ever become a line of its own.

pub const BEGIN: &str = "# >>> EYETIME BEGIN (managed, do not edit by hand) >>>";
pub const END: &str = "# <<< EYETIME END <<<";
pub const MAX_DOMAINS: usize = 3000;

/// A plain host name: letters, digits, hyphens and dots, at least one dot, a letter-only last part. No spaces, no slashes, nothing else.
pub fn valid_domain(d: &str) -> bool {
    if d.is_empty() || d.len() > 253 || !d.contains('.') {
        return false;
    }
    let labels: Vec<&str> = d.split('.').collect();
    for l in &labels {
        if l.is_empty() || l.len() > 63 || l.starts_with('-') || l.ends_with('-') {
            return false;
        }
        if !l
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        {
            return false;
        }
    }
    let tld = labels.last().unwrap();
    tld.len() >= 2
        && tld
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b == b'-' || b.is_ascii_digit())
        && !tld.bytes().all(|b| b.is_ascii_digit())
}

/// the names that go in the file: the address itself and its www. form
pub fn expand(domains: &[String]) -> Vec<String> {
    let mut v: Vec<String> = Vec::new();
    for d in domains {
        let d = d.trim().to_lowercase();
        let d = d.trim_start_matches("www.").to_string();
        if !valid_domain(&d) {
            continue;
        }
        v.push(format!("www.{d}"));
        v.push(d);
    }
    v.sort();
    v.dedup();
    v.truncate(MAX_DOMAINS);
    v
}

fn eol(text: &str) -> &'static str {
    if text.contains("\r\n") { "\r\n" } else { "\n" }
}

/// the file without our block
pub fn strip(existing: &str) -> String {
    let nl = eol(existing);
    let mut out: Vec<&str> = Vec::new();
    let mut inside = false;
    for line in existing.lines() {
        let t = line.trim();
        if t == BEGIN {
            inside = true;
            continue;
        }
        if t == END {
            inside = false;
            continue;
        }
        if !inside {
            out.push(line);
        }
    }
    // an unclosed block (damaged file) is dropped to the end rather than kept
    while out.last().map(|l| l.trim().is_empty()).unwrap_or(false) {
        out.pop();
    }
    let mut s = out.join(nl);
    if !s.is_empty() {
        s.push_str(nl);
    }
    s
}

/// the file with our block set to `domains` (an empty list removes the block)
pub fn render(existing: &str, domains: &[String]) -> String {
    let nl = eol(existing);
    let mut s = strip(existing);
    let names = expand(domains);
    if names.is_empty() {
        return s;
    }
    s.push_str(nl);
    s.push_str(BEGIN);
    s.push_str(nl);
    for n in &names {
        s.push_str("0.0.0.0 ");
        s.push_str(n);
        s.push_str(nl);
        s.push_str(":: ");
        s.push_str(n);
        s.push_str(nl);
    }
    s.push_str(END);
    s.push_str(nl);
    s
}

/// Is the file exactly what `render` would write? (Used to notice someone editing the block by hand.)
pub fn is_current(existing: &str, domains: &[String]) -> bool {
    render(existing, domains).replace("\r\n", "\n") == existing.replace("\r\n", "\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    const SAMPLE: &str = "# Copyright\r\n127.0.0.1 localhost\r\n::1 localhost\r\n";

    #[test]
    fn only_plain_names_pass() {
        for ok in [
            "youtube.com",
            "a-b.co.uk",
            "xn--80ak6aa92e.com",
            "m.youtube.com",
        ] {
            assert!(valid_domain(ok), "{ok}");
        }
        for bad in [
            "",
            "localhost",
            "a b.com",
            "evil.com\n127.0.0.1 bank.com",
            "a.com/path",
            "-a.com",
            "a-.com",
            "a..com",
            "A.com",
            "1.2.3.4",
            "a.com#x",
            "a.c",
            "$(x).com",
            "a.com\r",
        ] {
            assert!(!valid_domain(bad), "{bad:?}");
        }
        assert!(!valid_domain(&format!("{}.com", "a".repeat(64))));
    }

    #[test]
    fn the_block_is_added_replaced_and_removed() {
        let a = render(SAMPLE, &["youtube.com".into(), "x.com".into()]);
        assert!(a.starts_with(SAMPLE));
        assert!(a.contains("0.0.0.0 www.youtube.com\r\n"));
        assert!(a.contains(":: x.com\r\n"));
        assert_eq!(a.matches(BEGIN).count(), 1);
        let b = render(&a, &["reddit.com".into()]);
        assert!(!b.contains("youtube.com"));
        assert!(b.contains("reddit.com"));
        assert_eq!(b.matches(BEGIN).count(), 1);
        let c = render(&b, &[]);
        assert_eq!(c, SAMPLE);
    }

    #[test]
    fn nothing_but_names_can_get_into_the_file() {
        let a = render(
            SAMPLE,
            &[
                "ok.com".into(),
                "bad.com\r\n127.0.0.1 bank.com".into(),
                "localhost".into(),
            ],
        );
        assert!(a.contains("ok.com"));
        assert!(!a.contains("bank.com"));
        assert!(!a.contains("0.0.0.0 localhost"));
    }

    #[test]
    fn the_rest_of_the_file_and_its_line_endings_survive() {
        let unix = "127.0.0.1 localhost\n10.0.0.5 nas.home\n";
        let a = render(unix, &["x.com".into()]);
        assert!(!a.contains('\r'));
        assert!(a.starts_with(unix));
        assert_eq!(render(&a, &[]), unix);
    }

    #[test]
    fn a_damaged_block_is_cleaned_not_kept() {
        let broken = format!("{SAMPLE}{BEGIN}\r\n0.0.0.0 old.com\r\n");
        assert_eq!(strip(&broken), SAMPLE);
    }

    #[test]
    fn hand_edits_are_noticed() {
        let a = render(SAMPLE, &["x.com".into()]);
        assert!(is_current(&a, &["x.com".into()]));
        assert!(!is_current(
            &a.replace("0.0.0.0 x.com", "# 0.0.0.0 x.com"),
            &["x.com".into()]
        ));
        assert!(!is_current(SAMPLE, &["x.com".into()]));
        assert!(is_current(SAMPLE, &[]));
    }

    #[test]
    fn www_is_added_once() {
        let v = expand(&["www.x.com".into(), "x.com".into()]);
        assert_eq!(v, vec!["www.x.com".to_string(), "x.com".to_string()]);
    }

    /// a small deterministic generator, so that a failure can be repeated (no dependency)
    struct Gen(u64);
    impl Gen {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
        fn pick<'a>(&mut self, v: &[&'a str]) -> &'a str {
            v[(self.next() % v.len() as u64) as usize]
        }
    }

    #[test]
    fn whatever_is_in_the_file_and_the_lists_the_block_stays_one_clean_block() {
        let pieces = [
            "127.0.0.1 localhost",
            "# comment",
            "",
            "  ",
            BEGIN,
            END,
            "0.0.0.0 a.com",
            "::1 localhost",
            "1.2.3.4 bank.com # my bank",
        ];
        let names = [
            "youtube.com",
            "WWW.Reddit.com",
            "a b.com",
            "evil.com\n127.0.0.1 bank.com",
            "x",
            "",
            "m.facebook.com",
            "-bad.com",
            "ok.co.uk",
            "bank.com\r\n::1 y.com",
        ];
        let mut g = Gen(0x9E37_79B9_7F4A_7C15);
        for _ in 0..400 {
            let nl = if g.next().is_multiple_of(2) {
                "\r\n"
            } else {
                "\n"
            };
            let existing: String = (0..g.next() % 12)
                .map(|_| format!("{}{nl}", g.pick(&pieces)))
                .collect();
            let list: Vec<String> = (0..g.next() % 8)
                .map(|_| g.pick(&names).to_string())
                .collect();
            let once = render(&existing, &list);
            // the same lists again change nothing, and the file is recognised as current
            assert_eq!(
                render(&once, &list),
                once,
                "idempotent for {existing:?} {list:?}"
            );
            assert!(is_current(&once, &list));
            // at most one block, and nothing in it but the two address forms of a valid name
            assert!(once.matches(BEGIN).count() <= 1 && once.matches(END).count() <= 1);
            let mut inside = false;
            for line in once.lines() {
                if line.trim() == BEGIN {
                    inside = true;
                    continue;
                }
                if line.trim() == END {
                    inside = false;
                    continue;
                }
                if inside {
                    let (addr, name) = line.split_once(' ').expect("address and name");
                    assert!(addr == "0.0.0.0" || addr == "::", "{line:?}");
                    assert!(valid_domain(name), "{line:?}");
                }
            }
            // taking the block out gives back what was there without our block, whatever it was
            assert_eq!(
                strip(&once),
                strip(&existing),
                "strip undoes render for {existing:?}"
            );
            assert_eq!(render(&once, &[]), strip(&existing));
        }
    }
}
