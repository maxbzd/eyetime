//! Updates: how a new version is recognised, and what the window is told about it. No network in here, only decisions.
//! The releases are the ones of the project's GitHub page: a tag "desktop-v0.2.0" with the installer attached.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// where releases may be downloaded from (nothing else is ever run)
pub const ALLOWED_PREFIX: &str = "https://github.com/maxbzd/eyetime/releases/download/";
pub const RELEASES_URL: &str = "https://api.github.com/repos/maxbzd/eyetime/releases?per_page=30";
pub const ASSET: &str = "EyeTime-Setup.exe";
pub const TAG_PREFIX: &str = "desktop-v";
/// a download bigger than this is refused
pub const MAX_BYTES: u64 = 200 * 1024 * 1024;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct UpdateInfo {
    pub version: String,
    /// the bullet points of the release notes
    pub notes: Vec<String>,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

/// what was installed by the last update, shown once as "what's new"
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct Updated {
    pub from: String,
    pub to: String,
    pub notes: Vec<String>,
}

pub fn parse_version(s: &str) -> Option<(u32, u32, u32)> {
    let s = s.trim().trim_start_matches(TAG_PREFIX).trim_start_matches('v');
    let core = s.split(['-', '+']).next()?;
    let mut it = core.split('.');
    let (a, b, c) = (it.next()?.parse().ok()?, it.next().unwrap_or("0").parse().ok()?, it.next().unwrap_or("0").parse().ok()?);
    if it.next().is_some() {
        return None;
    }
    Some((a, b, c))
}

pub fn is_newer(current: &str, candidate: &str) -> bool {
    match (parse_version(current), parse_version(candidate)) {
        (Some(c), Some(n)) => n > c,
        _ => false,
    }
}

/// the "- point" lines of a release's text
pub fn notes_of(body: &str) -> Vec<String> {
    body.lines().map(|l| l.trim()).filter_map(|l| l.strip_prefix("- ").or_else(|| l.strip_prefix("* "))).map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).take(12).collect()
}

fn hex64(s: &str) -> Option<String> {
    let low = s.trim().to_lowercase();
    let h = low.trim_start_matches("sha256:").to_string();
    (h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit())).then_some(h)
}

/// From the page's list of releases (the JSON GitHub sends): the newest desktop release that is newer than `current`, with an installer that can be checked.
pub fn newest(json: &str, current: &str) -> Result<Option<UpdateInfo>, String> {
    let v: serde_json::Value = serde_json::from_str(json).map_err(|e| format!("not a release list: {e}"))?;
    let list = v.as_array().ok_or("not a release list")?;
    let mut best: Option<((u32, u32, u32), UpdateInfo)> = None;
    for r in list {
        let tag = r["tag_name"].as_str().unwrap_or("");
        if !tag.starts_with(TAG_PREFIX) || r["draft"].as_bool().unwrap_or(false) || r["prerelease"].as_bool().unwrap_or(false) {
            continue;
        }
        let Some(ver) = parse_version(tag) else { continue };
        if !is_newer(current, tag) {
            continue;
        }
        let Some(asset) = r["assets"].as_array().and_then(|a| a.iter().find(|x| x["name"].as_str() == Some(ASSET))) else { continue };
        let url = asset["browser_download_url"].as_str().unwrap_or("");
        let size = asset["size"].as_u64().unwrap_or(0);
        // only an installer that can be checked, from where we expect it, of a sane size
        let Some(sha) = asset["digest"].as_str().and_then(hex64) else { continue };
        if !url.starts_with(ALLOWED_PREFIX) || size == 0 || size > MAX_BYTES {
            continue;
        }
        let info = UpdateInfo { version: format!("{}.{}.{}", ver.0, ver.1, ver.2), notes: notes_of(r["body"].as_str().unwrap_or("")), url: url.to_string(), sha256: sha, size };
        if best.as_ref().map(|(b, _)| ver > *b).unwrap_or(true) {
            best = Some((ver, info));
        }
    }
    Ok(best.map(|(_, i)| i))
}

/// the same, from a local file of the form {version,url,sha256,size,notes}: used by the tests and by whoever runs their own feed
pub fn from_feed(json: &str, current: &str, allow_any_url: bool) -> Result<Option<UpdateInfo>, String> {
    let i: UpdateInfo = serde_json::from_str(json).map_err(|e| format!("bad feed: {e}"))?;
    if !is_newer(current, &i.version) {
        return Ok(None);
    }
    if hex64(&i.sha256).is_none() || i.size == 0 || i.size > MAX_BYTES || (!allow_any_url && !i.url.starts_with(ALLOWED_PREFIX)) {
        return Err("the feed names an installer that cannot be checked".into());
    }
    Ok(Some(i))
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn sha256_file(path: &std::path::Path) -> std::io::Result<String> {
    use std::io::Read;
    let mut f = std::fs::File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

pub fn same_hash(a: &str, b: &str) -> bool {
    match (hex64(a), hex64(b)) {
        (Some(x), Some(y)) => x == y,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, sha: &str, url: &str, size: u64) -> String {
        format!(r#"{{"tag_name":"{tag}","draft":false,"prerelease":false,"body":"What is new\n- Updates by themselves\n- Calmer charts\n\nThanks","assets":[{{"name":"EyeTime-Setup.exe","browser_download_url":"{url}","size":{size},"digest":"sha256:{sha}"}}]}}"#)
    }
    const SHA: &str = "ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12ab12";
    fn url(tag: &str) -> String {
        format!("{ALLOWED_PREFIX}{tag}/EyeTime-Setup.exe")
    }

    #[test]
    fn versions_compare_as_numbers_not_as_text() {
        assert!(is_newer("0.1.0", "0.2.0"));
        assert!(is_newer("0.9.0", "0.10.0"));
        assert!(is_newer("0.1.9", "desktop-v0.1.10"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("1.0.0", "0.9.9"));
        assert!(!is_newer("0.1.0", "not a version"));
        assert_eq!(parse_version("desktop-v1.2.3-beta"), Some((1, 2, 3)));
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn the_newest_desktop_release_is_found_among_other_releases() {
        let t2 = "desktop-v0.2.0";
        let t3 = "desktop-v0.3.0";
        let list = format!("[{},{},{},{}]", release("v3.7.0", SHA, &url("v3.7.0"), 100), release(t2, SHA, &url(t2), 5_000_000), release(t3, SHA, &url(t3), 5_100_000), release("desktop-v0.1.0", SHA, &url("desktop-v0.1.0"), 4_000_000));
        let i = newest(&list, "0.1.0").unwrap().unwrap();
        assert_eq!(i.version, "0.3.0");
        assert_eq!(i.notes, vec!["Updates by themselves".to_string(), "Calmer charts".to_string()]);
        assert_eq!(i.sha256, SHA);
        assert_eq!(newest(&list, "0.3.0").unwrap(), None);
    }

    #[test]
    fn anything_that_cannot_be_checked_or_comes_from_elsewhere_is_ignored() {
        let t = "desktop-v0.2.0";
        let no_digest = r#"[{"tag_name":"desktop-v0.2.0","assets":[{"name":"EyeTime-Setup.exe","browser_download_url":"https://github.com/maxbzd/eyetime/releases/download/desktop-v0.2.0/EyeTime-Setup.exe","size":1000}]}]"#;
        assert_eq!(newest(no_digest, "0.1.0").unwrap(), None);
        let elsewhere = format!("[{}]", release(t, SHA, "https://evil.example/EyeTime-Setup.exe", 1000));
        assert_eq!(newest(&elsewhere, "0.1.0").unwrap(), None);
        let huge = format!("[{}]", release(t, SHA, &url(t), MAX_BYTES + 1));
        assert_eq!(newest(&huge, "0.1.0").unwrap(), None);
        let bad_hash = format!("[{}]", release(t, "zz", &url(t), 1000));
        assert_eq!(newest(&bad_hash, "0.1.0").unwrap(), None);
        let draft = release(t, SHA, &url(t), 1000).replace("\"draft\":false", "\"draft\":true");
        assert_eq!(newest(&format!("[{draft}]"), "0.1.0").unwrap(), None);
        assert!(newest("not json", "0.1.0").is_err());
    }

    #[test]
    fn a_feed_file_is_held_to_the_same_rules_unless_it_is_ours() {
        let f = format!(r#"{{"version":"0.2.0","url":"C:\\x\\EyeTime-Setup.exe","sha256":"{SHA}","size":10,"notes":["a"]}}"#);
        assert!(from_feed(&f, "0.1.0", false).is_err());
        assert_eq!(from_feed(&f, "0.1.0", true).unwrap().unwrap().version, "0.2.0");
        assert_eq!(from_feed(&f, "0.2.0", true).unwrap(), None);
    }

    #[test]
    fn hashes_are_compared_as_hashes() {
        assert_eq!(sha256_hex(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert!(same_hash("SHA256:BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
        assert!(!same_hash(SHA, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
        assert!(!same_hash("", ""));
    }
}
