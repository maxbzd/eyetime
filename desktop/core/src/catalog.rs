//! What the names in the lists mean: which addresses and which programs. Brands first, then whole categories.
//! The lists are a seed, small on purpose: they are meant to be refreshed from a signed file shipped with updates.

use crate::model::Item;

/// (name as the interface writes it, addresses, programs)
const BRANDS: &[(&str, &[&str], &[&str])] = &[
    ("instagram", &["instagram.com", "cdninstagram.com"], &[]),
    ("youtube", &["youtube.com", "youtu.be", "youtube-nocookie.com", "m.youtube.com"], &[]),
    ("x", &["x.com", "twitter.com", "t.co"], &[]),
    ("twitter", &["x.com", "twitter.com", "t.co"], &[]),
    ("tiktok", &["tiktok.com", "tiktokcdn.com"], &[]),
    ("reddit", &["reddit.com", "redd.it", "redditstatic.com"], &[]),
    ("netflix", &["netflix.com", "nflxvideo.net"], &["netflix.exe"]),
    ("facebook", &["facebook.com", "fb.com", "fbcdn.net"], &[]),
    ("telegram", &["telegram.org", "web.telegram.org", "t.me"], &["telegram.exe"]),
    ("discord", &["discord.com", "discordapp.com", "discord.gg"], &["discord.exe"]),
    ("steam", &["steampowered.com", "steamcommunity.com"], &["steam.exe", "steamwebhelper.exe"]),
    ("whatsapp", &["whatsapp.com", "web.whatsapp.com"], &["whatsapp.exe"]),
    ("twitch", &["twitch.tv"], &[]),
    ("slack", &["slack.com"], &["slack.exe"]),
    ("notion", &["notion.so"], &["notion.exe"]),
    ("spotify", &["spotify.com", "open.spotify.com"], &["spotify.exe"]),
    ("vk", &["vk.com", "vkvideo.ru"], &[]),
    ("vs code", &[], &["code.exe"]),
    ("figma", &["figma.com"], &["figma.exe"]),
    ("terminal", &[], &["windowsterminal.exe", "cmd.exe", "powershell.exe"]),
    ("chrome", &[], &["chrome.exe"]),
    ("calendar", &["calendar.google.com", "outlook.live.com"], &[]),
];

/// the 12 categories of the interface
pub const CATEGORY_NAMES: [&str; 12] = ["Social media", "Video", "Streaming", "Messengers", "News", "Games", "Shopping", "Adult", "AI chats", "Forums", "Gambling", "Email"];

pub fn category_domains(name: &str) -> &'static [&'static str] {
    match name {
        "Social media" => &["instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com", "snapchat.com", "pinterest.com", "tumblr.com", "linkedin.com", "vk.com", "ok.ru", "threads.net", "bsky.app", "mastodon.social"],
        "Video" => &["youtube.com", "youtu.be", "twitch.tv", "vimeo.com", "dailymotion.com", "rutube.ru", "bilibili.com", "kick.com"],
        "Streaming" => &["netflix.com", "primevideo.com", "disneyplus.com", "hulu.com", "hbomax.com", "max.com", "kinopoisk.ru", "ivi.ru", "okko.tv", "crunchyroll.com"],
        "Messengers" => &["web.telegram.org", "web.whatsapp.com", "discord.com", "messenger.com", "viber.com", "slack.com", "signal.org", "skype.com"],
        "News" => &["news.google.com", "bbc.com", "cnn.com", "nytimes.com", "theguardian.com", "foxnews.com", "reuters.com", "lenta.ru", "rbc.ru", "meduza.io", "news.ycombinator.com", "buzzfeed.com", "dailymail.co.uk"],
        "Games" => &["steampowered.com", "steamcommunity.com", "epicgames.com", "roblox.com", "miniclip.com", "poki.com", "crazygames.com", "itch.io", "battle.net", "leagueoflegends.com", "minecraft.net"],
        "Shopping" => &["amazon.com", "ebay.com", "aliexpress.com", "temu.com", "shein.com", "etsy.com", "wildberries.ru", "ozon.ru", "walmart.com", "target.com"],
        "Adult" => &["pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com", "youporn.com", "onlyfans.com", "chaturbate.com", "stripchat.com"],
        "AI chats" => &["chatgpt.com", "chat.openai.com", "gemini.google.com", "claude.ai", "perplexity.ai", "character.ai", "poe.com", "copilot.microsoft.com"],
        "Forums" => &["reddit.com", "quora.com", "4chan.org", "pikabu.ru", "habr.com", "stackexchange.com", "disqus.com", "9gag.com"],
        "Gambling" => &["bet365.com", "stake.com", "1xbet.com", "pokerstars.com", "draftkings.com", "fanduel.com", "betway.com", "parimatch.com", "fonbet.ru", "olimpbet.ru"],
        "Email" => &["mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com", "mail.ru", "e.mail.ru", "proton.me"],
        _ => &[],
    }
}

pub fn category_exes(name: &str) -> &'static [&'static str] {
    match name {
        "Games" => &["steam.exe", "epicgameslauncher.exe", "battle.net.exe", "riotclientservices.exe", "leagueclient.exe", "minecraftlauncher.exe", "origin.exe", "ubisoftconnect.exe", "gog galaxy.exe"],
        "Messengers" => &["telegram.exe", "whatsapp.exe", "discord.exe", "viber.exe", "signal.exe", "skype.exe", "slack.exe"],
        "Streaming" => &["netflix.exe", "spotify.exe"],
        _ => &[],
    }
}

fn brand(name: &str) -> Option<&'static (&'static str, &'static [&'static str], &'static [&'static str])> {
    let n = name.trim().to_lowercase();
    BRANDS.iter().find(|b| b.0 == n)
}

/// A name or an address in the interface's list becomes the addresses it stands for.
pub fn item_domains(it: &Item) -> Vec<String> {
    let mut v: Vec<String> = Vec::new();
    if !it.domain.trim().is_empty() {
        v.push(it.domain.trim().to_lowercase());
    }
    if let Some(b) = brand(&it.name) {
        v.extend(b.1.iter().map(|d| d.to_string()));
    }
    let n = it.name.trim().to_lowercase();
    if n.contains('.') && !n.contains(' ') && !n.ends_with(".exe") {
        v.push(n.trim_start_matches("www.").to_string());
    }
    v.sort();
    v.dedup();
    v
}

/// ... and the programs it stands for (lower case file names).
pub fn item_exes(it: &Item) -> Vec<String> {
    let mut v: Vec<String> = Vec::new();
    if !it.exe.trim().is_empty() {
        v.push(it.exe.trim().to_lowercase());
    }
    if let Some(b) = brand(&it.name) {
        v.extend(b.2.iter().map(|d| d.to_string()));
    }
    let n = it.name.trim().to_lowercase();
    if n.ends_with(".exe") {
        v.push(n);
    } else if it.kind == "app" && v.is_empty() {
        v.push(format!("{}.exe", n.replace(' ', "")));
    }
    v.sort();
    v.dedup();
    v
}

/// Programs that must never be closed whatever the list says: the system itself and EyeTime.
pub const NEVER_CLOSE: &[&str] = &[
    "system", "registry", "smss.exe", "csrss.exe", "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe", "svchost.exe", "dwm.exe", "explorer.exe", "fontdrvhost.exe", "sihost.exe", "taskhostw.exe", "ctfmon.exe", "audiodg.exe", "searchhost.exe", "startmenuexperiencehost.exe",
    "shellexperiencehost.exe", "textinputhost.exe", "runtimebroker.exe", "applicationframehost.exe", "msedgewebview2.exe", "eyetime.exe", "eyetime-helper.exe", "eyetime-setup.exe", "conhost.exe", "wudfhost.exe", "dllhost.exe", "securityhealthsystray.exe", "lockapp.exe", "logonui.exe",
];

pub fn never_close(exe: &str) -> bool {
    let e = exe.to_lowercase();
    NEVER_CLOSE.contains(&e.as_str())
}

/// Browsers: the ones whose private windows can be closed.
pub const BROWSERS: &[&str] = &["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "vivaldi.exe", "yandex.exe", "browser.exe"];
/// Windows tools used to undo a block: closed in Frozen sessions (Task Manager is handled through the policy as well).
pub const TOOLS_CLOSED_WHEN_FROZEN: &[&str] = &["taskmgr.exe", "systemsettings.exe", "regedit.exe", "mmc.exe", "control.exe", "perfmon.exe", "resmon.exe", "procexp.exe", "procexp64.exe", "processhacker.exe"];
/// Tools that open the way around a block.
pub const VPN_AND_PROXY: &[&str] = &["openvpn.exe", "nordvpn.exe", "expressvpn.exe", "protonvpn.exe", "windscribe.exe", "wireguard.exe", "tailscale.exe", "psiphon3.exe", "tor.exe", "v2rayn.exe", "clash.exe", "cloudflare warp.exe", "warp-svc.exe", "hotspotshield.exe", "surfshark.exe", "mullvad vpn.exe"];

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn brands_and_addresses() {
        let it = Item { name: "YouTube".into(), kind: "site".into(), ..Default::default() };
        assert!(item_domains(&it).contains(&"youtu.be".to_string()));
        let it = Item { name: "https-less.example.com".into(), kind: "site".into(), ..Default::default() };
        assert_eq!(item_domains(&it), vec!["https-less.example.com".to_string()]);
        let it = Item { name: "Slack".into(), kind: "app".into(), ..Default::default() };
        assert_eq!(item_exes(&it), vec!["slack.exe".to_string()]);
        let it = Item { name: "My Game".into(), kind: "app".into(), ..Default::default() };
        assert_eq!(item_exes(&it), vec!["mygame.exe".to_string()]);
    }
    #[test]
    fn system_programs_are_safe() {
        assert!(never_close("Explorer.EXE"));
        assert!(never_close("EyeTime-helper.exe"));
        assert!(!never_close("steam.exe"));
    }
    #[test]
    fn every_category_has_something() {
        for c in CATEGORY_NAMES {
            assert!(!category_domains(c).is_empty(), "{c}");
        }
    }
}
