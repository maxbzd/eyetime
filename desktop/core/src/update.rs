// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! Updates: how a new version is recognised, and what the window is told about it. No network in here, only decisions.
//! The releases are the ones of the project's GitHub page: a tag "desktop-v0.2.0" with the installer attached.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// where releases may be downloaded from (nothing else is ever run)
pub const ALLOWED_PREFIX: &str = "https://github.com/maxbzd/eyetime/releases/download/";
pub const RELEASES_URL: &str = "https://api.github.com/repos/maxbzd/eyetime/releases?per_page=30";
pub const ASSET: &str = "EyeTime-Setup.exe";
/// the signature of the installer, made by the release job with a key that only that job has
pub const SIG_ASSET: &str = "EyeTime-Setup.exe.sig";
/// The public halves of the keys that may sign an update. An update is run only if one of them signed exactly this version and exactly
/// this file, so that a stolen release account (which can upload any file) is not enough to get a program run on every computer.
///
/// A list, so that the key can be changed without stranding anybody (see SECURITY.md, "Changing the signing key"):
/// 1. release a version that lists the old key and the new one, signed with the old key;
/// 2. when it is out, sign releases with the new key;
/// 3. a later release drops the old key (and if the old key was stolen, this is the release that must go out first: it is signed with
///    the key that is still good, and nothing signed with the stolen one is accepted after it).
///
/// The first entry is the key the release job signs with now.
pub const UPDATE_PUBKEYS_HEX: &[&str] =
    &["1ebbc0aa56ba7b69b4b03933a7c432c6bc0780c52a7c5be0b7f0a58e21cff5d6"];
/// the key the release job signs with now
pub const UPDATE_PUBKEY_HEX: &str = UPDATE_PUBKEYS_HEX[0];
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
    /// where the signature is (empty for a feed file of the administrator's own, which is not signed)
    pub sig_url: String,
}

/// what was installed by the last update, shown once as "what's new"
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct Updated {
    pub from: String,
    pub to: String,
    pub notes: Vec<String>,
}

/// (major, minor, patch, 1 for a release and 0 for a pre-release such as 1.2.3-beta, which is older than 1.2.3)
pub fn parse_version(s: &str) -> Option<(u32, u32, u32, u8)> {
    let s = s
        .trim()
        .trim_start_matches(TAG_PREFIX)
        .trim_start_matches('v');
    let pre = s.split('+').next()?.contains('-');
    let core = s.split(['-', '+']).next()?;
    let mut it = core.split('.');
    let (a, b, c) = (
        it.next()?.parse().ok()?,
        it.next().unwrap_or("0").parse().ok()?,
        it.next().unwrap_or("0").parse().ok()?,
    );
    if it.next().is_some() {
        return None;
    }
    Some((a, b, c, if pre { 0 } else { 1 }))
}

pub fn is_newer(current: &str, candidate: &str) -> bool {
    match (parse_version(current), parse_version(candidate)) {
        (Some(c), Some(n)) => n > c,
        _ => false,
    }
}

/// the "- point" lines of a release's text
pub fn notes_of(body: &str) -> Vec<String> {
    body.lines()
        .map(|l| l.trim())
        .filter_map(|l| l.strip_prefix("- ").or_else(|| l.strip_prefix("* ")))
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .take(12)
        .collect()
}

fn hex64(s: &str) -> Option<String> {
    let low = s.trim().to_lowercase();
    let h = low.trim_start_matches("sha256:").to_string();
    (h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit())).then_some(h)
}

/// From the page's list of releases (the JSON GitHub sends): the newest desktop release that is newer than `current`, with an installer that can be checked.
pub fn newest(json: &str, current: &str) -> Result<Option<UpdateInfo>, String> {
    let v: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("not a release list: {e}"))?;
    let list = v.as_array().ok_or("not a release list")?;
    let mut best: Option<((u32, u32, u32, u8), UpdateInfo)> = None;
    for r in list {
        let tag = r["tag_name"].as_str().unwrap_or("");
        if !tag.starts_with(TAG_PREFIX)
            || r["draft"].as_bool().unwrap_or(false)
            || r["prerelease"].as_bool().unwrap_or(false)
        {
            continue;
        }
        let Some(ver) = parse_version(tag) else {
            continue;
        };
        if !is_newer(current, tag) {
            continue;
        }
        let Some(asset) = r["assets"]
            .as_array()
            .and_then(|a| a.iter().find(|x| x["name"].as_str() == Some(ASSET)))
        else {
            continue;
        };
        let url = asset["browser_download_url"].as_str().unwrap_or("");
        let size = asset["size"].as_u64().unwrap_or(0);
        // only an installer that can be checked, from where we expect it, of a sane size
        let Some(sha) = asset["digest"].as_str().and_then(hex64) else {
            continue;
        };
        if !url.starts_with(ALLOWED_PREFIX) || size == 0 || size > MAX_BYTES {
            continue;
        }
        // and only one that carries a signature file, from the same place
        let Some(sig_url) = r["assets"]
            .as_array()
            .and_then(|a| a.iter().find(|x| x["name"].as_str() == Some(SIG_ASSET)))
            .and_then(|x| x["browser_download_url"].as_str())
            .filter(|u| u.starts_with(ALLOWED_PREFIX))
        else {
            continue;
        };
        let info = UpdateInfo {
            version: format!("{}.{}.{}", ver.0, ver.1, ver.2),
            notes: notes_of(r["body"].as_str().unwrap_or("")),
            url: url.to_string(),
            sha256: sha,
            size,
            sig_url: sig_url.to_string(),
        };
        if best.as_ref().map(|(b, _)| ver > *b).unwrap_or(true) {
            best = Some((ver, info));
        }
    }
    Ok(best.map(|(_, i)| i))
}

/// the same, from a local file of the form {version,url,sha256,size,notes}: used by the tests and by whoever runs their own feed
pub fn from_feed(
    json: &str,
    current: &str,
    allow_any_url: bool,
) -> Result<Option<UpdateInfo>, String> {
    let i: UpdateInfo = serde_json::from_str(json).map_err(|e| format!("bad feed: {e}"))?;
    if !is_newer(current, &i.version) {
        return Ok(None);
    }
    if hex64(&i.sha256).is_none()
        || i.size == 0
        || i.size > MAX_BYTES
        || (!allow_any_url && !i.url.starts_with(ALLOWED_PREFIX))
    {
        return Err("the feed names an installer that cannot be checked".into());
    }
    Ok(Some(i))
}

/// 64 hex characters -> 32 bytes
pub fn from_hex32(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, o) in out.iter_mut().enumerate() {
        *o = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).ok()?;
    }
    Some(out)
}

fn signed_message(version: &str, sha256: &str) -> Vec<u8> {
    format!(
        "eyetime-update-v1|{}|{}",
        version.trim(),
        sha256.trim().to_lowercase().trim_start_matches("sha256:")
    )
    .into_bytes()
}

/// the release job: sign this version of this file
pub fn sign_update(seed: &[u8; 32], version: &str, sha256: &str) -> String {
    use ed25519_dalek::Signer;
    let sig = ed25519_dalek::SigningKey::from_bytes(seed).sign(&signed_message(version, sha256));
    sig.to_bytes().iter().map(|b| format!("{b:02x}")).collect()
}

/// the app: did the key say this version of this file is ours? (`sig_hex` is the text of the signature file)
pub fn verify_update(pubkey: &[u8; 32], version: &str, sha256: &str, sig_hex: &str) -> bool {
    use ed25519_dalek::Verifier;
    let hex = sig_hex.trim();
    if hex.len() != 128 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return false;
    }
    let mut bytes = [0u8; 64];
    for (i, o) in bytes.iter_mut().enumerate() {
        match u8::from_str_radix(&hex[2 * i..2 * i + 2], 16) {
            Ok(v) => *o = v,
            Err(_) => return false,
        }
    }
    let Ok(key) = ed25519_dalek::VerifyingKey::from_bytes(pubkey) else {
        return false;
    };
    key.verify(
        &signed_message(version, sha256),
        &ed25519_dalek::Signature::from_bytes(&bytes),
    )
    .is_ok()
}

/// the public key that belongs to a private seed (for the tools and the tests)
pub fn pubkey_of(seed: &[u8; 32]) -> [u8; 32] {
    ed25519_dalek::SigningKey::from_bytes(seed)
        .verifying_key()
        .to_bytes()
}

/// the key built into this version that signs now
pub fn builtin_pubkey() -> [u8; 32] {
    from_hex32(UPDATE_PUBKEY_HEX).unwrap_or([0u8; 32])
}

/// every key built into this version that may sign an update (an entry that does not parse is left out, never replaced by a zero key)
pub fn builtin_pubkeys() -> Vec<[u8; 32]> {
    UPDATE_PUBKEYS_HEX
        .iter()
        .filter_map(|h| from_hex32(h))
        .collect()
}

/// `verify_update` against a list of trusted keys: true if any of them signed it. An empty list trusts nothing.
pub fn verify_update_any(pubkeys: &[[u8; 32]], version: &str, sha256: &str, sig_hex: &str) -> bool {
    pubkeys
        .iter()
        .any(|k| verify_update(k, version, sha256, sig_hex))
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
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
        format!(
            r#"{{"tag_name":"{tag}","draft":false,"prerelease":false,"body":"What is new\n- Updates by themselves\n- Calmer charts\n\nThanks","assets":[{{"name":"EyeTime-Setup.exe","browser_download_url":"{url}","size":{size},"digest":"sha256:{sha}"}},{{"name":"EyeTime-Setup.exe.sig","browser_download_url":"{url}.sig","size":128}}]}}"#
        )
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
        assert_eq!(parse_version("desktop-v1.2.3-beta"), Some((1, 2, 3, 0)));
        assert!(
            is_newer("1.2.3-beta", "1.2.3"),
            "the release is newer than its own beta"
        );
        assert!(!is_newer("1.2.3", "1.2.3-beta"));
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn the_newest_desktop_release_is_found_among_other_releases() {
        let t2 = "desktop-v0.2.0";
        let t3 = "desktop-v0.3.0";
        let list = format!(
            "[{},{},{},{}]",
            release("v3.7.0", SHA, &url("v3.7.0"), 100),
            release(t2, SHA, &url(t2), 5_000_000),
            release(t3, SHA, &url(t3), 5_100_000),
            release("desktop-v0.1.0", SHA, &url("desktop-v0.1.0"), 4_000_000)
        );
        let i = newest(&list, "0.1.0").unwrap().unwrap();
        assert_eq!(i.version, "0.3.0");
        assert_eq!(
            i.notes,
            vec![
                "Updates by themselves".to_string(),
                "Calmer charts".to_string()
            ]
        );
        assert_eq!(i.sha256, SHA);
        assert_eq!(newest(&list, "0.3.0").unwrap(), None);
    }

    #[test]
    fn anything_that_cannot_be_checked_or_comes_from_elsewhere_is_ignored() {
        let t = "desktop-v0.2.0";
        let no_digest = r#"[{"tag_name":"desktop-v0.2.0","assets":[{"name":"EyeTime-Setup.exe","browser_download_url":"https://github.com/maxbzd/eyetime/releases/download/desktop-v0.2.0/EyeTime-Setup.exe","size":1000}]}]"#;
        assert_eq!(newest(no_digest, "0.1.0").unwrap(), None);
        let elsewhere = format!(
            "[{}]",
            release(t, SHA, "https://evil.example/EyeTime-Setup.exe", 1000)
        );
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
        let f = format!(
            r#"{{"version":"0.2.0","url":"C:\\x\\EyeTime-Setup.exe","sha256":"{SHA}","size":10,"notes":["a"]}}"#
        );
        assert!(from_feed(&f, "0.1.0", false).is_err());
        assert_eq!(
            from_feed(&f, "0.1.0", true).unwrap().unwrap().version,
            "0.2.0"
        );
        assert_eq!(from_feed(&f, "0.2.0", true).unwrap(), None);
    }

    #[test]
    fn hashes_are_compared_as_hashes() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert!(same_hash(
            "SHA256:BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        ));
        assert!(!same_hash(
            SHA,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        ));
        assert!(!same_hash("", ""));
    }

    #[test]
    fn a_release_without_a_signature_file_is_ignored() {
        let t = "desktop-v0.2.0";
        let unsigned = release(t, SHA, &url(t), 1000).replace(
            ",{\"name\":\"EyeTime-Setup.exe.sig\",\"browser_download_url\":\"",
            ",{\"name\":\"notes.txt\",\"browser_download_url\":\"",
        );
        assert_eq!(newest(&format!("[{unsigned}]"), "0.1.0").unwrap(), None);
        let signed = newest(&format!("[{}]", release(t, SHA, &url(t), 1000)), "0.1.0")
            .unwrap()
            .unwrap();
        assert!(
            signed.sig_url.ends_with("EyeTime-Setup.exe.sig")
                && signed.sig_url.starts_with(ALLOWED_PREFIX)
        );
    }

    #[test]
    fn only_the_key_can_say_that_a_version_of_a_file_is_ours() {
        let seed = [7u8; 32];
        let key = ed25519_dalek::SigningKey::from_bytes(&seed)
            .verifying_key()
            .to_bytes();
        let sig = sign_update(&seed, "0.2.0", SHA);
        assert!(verify_update(&key, "0.2.0", SHA, &sig));
        assert!(
            verify_update(
                &key,
                "0.2.0",
                &format!("SHA256:{}", SHA.to_uppercase()),
                &sig
            ),
            "the spelling of the fingerprint does not matter"
        );
        assert!(!verify_update(&key, "0.2.1", SHA, &sig), "another version");
        assert!(
            !verify_update(
                &key,
                "0.2.0",
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                &sig
            ),
            "another file"
        );
        let other = ed25519_dalek::SigningKey::from_bytes(&[8u8; 32])
            .verifying_key()
            .to_bytes();
        assert!(!verify_update(&other, "0.2.0", SHA, &sig), "another key");
        assert!(!verify_update(&key, "0.2.0", SHA, ""), "no signature");
        assert!(
            !verify_update(&key, "0.2.0", SHA, &"0".repeat(128)),
            "a made-up signature"
        );
        assert!(
            !verify_update(&key, "0.2.0", SHA, "zz"),
            "text that is not a signature"
        );
        assert!(
            from_hex32(UPDATE_PUBKEY_HEX).is_some(),
            "the built-in key is a real key"
        );
    }

    #[test]
    fn any_of_the_listed_keys_may_sign_and_no_other() {
        let (old, new, thief) = ([1u8; 32], [2u8; 32], [3u8; 32]);
        let keys = vec![pubkey_of(&old), pubkey_of(&new)];
        let sig = |seed: &[u8; 32]| sign_update(seed, "0.3.0", SHA);
        assert!(
            verify_update_any(&keys, "0.3.0", SHA, &sig(&old)),
            "the old key"
        );
        assert!(
            verify_update_any(&keys, "0.3.0", SHA, &sig(&new)),
            "the new key"
        );
        assert!(
            !verify_update_any(&keys, "0.3.0", SHA, &sig(&thief)),
            "a key that is not listed"
        );
        assert!(
            !verify_update_any(&[], "0.3.0", SHA, &sig(&old)),
            "an empty list trusts nothing"
        );
        // a stolen key that a later release dropped from the list signs nothing any more
        assert!(!verify_update_any(&keys[1..], "0.3.0", SHA, &sig(&old)));
    }

    #[test]
    fn every_built_in_key_parses_and_the_signing_key_is_the_first() {
        assert!(!UPDATE_PUBKEYS_HEX.is_empty());
        assert_eq!(
            builtin_pubkeys().len(),
            UPDATE_PUBKEYS_HEX.len(),
            "a key that does not parse would silently shrink the list"
        );
        assert_eq!(builtin_pubkeys()[0], builtin_pubkey());
    }
}
