//! The network half of updates: look for a newer version now and then, and fetch it when the person (or the automatic setting) asks.
//! It only talks; whether and when the new installer runs is decided by the supervisor, with the same care as everything else.

use eyetime_core::update::{from_feed, newest, same_hash, sha256_file, UpdateInfo, MAX_BYTES, RELEASES_URL};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub trait Net: Send + Sync {
    fn get(&self, url: &str) -> Result<String, String>;
    /// fetch `url` into `dest`, telling how many bytes are there so far
    fn download(&self, url: &str, dest: &Path, progress: &dyn Fn(u64)) -> Result<(), String>;
    /// the text of a local feed file, for tests and for people who run their own
    fn local_feed(&self) -> Option<String>;
    fn dir(&self) -> PathBuf;
}

#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub enum Phase {
    #[default]
    Idle,
    Checking,
    Available,
    Downloading,
    Ready,
    Installing,
    Error,
}
impl Phase {
    pub fn name(&self) -> &'static str {
        match self {
            Phase::Idle => "idle",
            Phase::Checking => "checking",
            Phase::Available => "available",
            Phase::Downloading => "downloading",
            Phase::Ready => "ready",
            Phase::Installing => "installing",
            Phase::Error => "error",
        }
    }
}

#[derive(Default, Debug)]
pub struct Shared {
    pub phase: Phase,
    pub info: Option<UpdateInfo>,
    pub pct: u32,
    pub error: String,
    pub checked_ms: i64,
    pub want_check: bool,
    pub want_install: bool,
    /// the person asked (as opposed to the automatic setting)
    pub manual: bool,
    pub path: Option<PathBuf>,
}

pub const EVERY_MS: i64 = 6 * 3_600_000;
pub const RETRY_MS: i64 = 30 * 60_000;

pub struct Updater<N: Net> {
    pub net: N,
    pub shared: Arc<Mutex<Shared>>,
    pub current: String,
}

fn lock(s: &Arc<Mutex<Shared>>) -> std::sync::MutexGuard<'_, Shared> {
    s.lock().unwrap_or_else(|e| e.into_inner())
}

impl<N: Net> Updater<N> {
    pub fn new(net: N, shared: Arc<Mutex<Shared>>, current: &str) -> Updater<N> {
        { let mut g = lock(&shared); if g.checked_ms == 0 { g.checked_ms = i64::MIN / 4; } } // never looked yet: look at the first turn
        Updater { net, shared, current: current.to_string() }
    }

    /// One turn of the work: look, or fetch, if something asks for it. The server calls this about once a second.
    pub fn step(&self, now_ms: i64) {
        let (check, fetch) = {
            let s = lock(&self.shared);
            let busy = matches!(s.phase, Phase::Checking | Phase::Downloading | Phase::Installing | Phase::Ready);
            let every = if s.phase == Phase::Error { RETRY_MS } else { EVERY_MS };
            (!busy && (s.want_check || now_ms - s.checked_ms >= every), s.want_install && s.phase == Phase::Available)
        };
        if check {
            self.check(now_ms);
        }
        if fetch {
            self.fetch();
        }
    }

    fn check(&self, now_ms: i64) {
        {
            let mut s = lock(&self.shared);
            s.phase = Phase::Checking;
            s.want_check = false;
        }
        let found = match self.net.local_feed() {
            Some(text) => from_feed(&text, &self.current, true),
            None => self.net.get(RELEASES_URL).and_then(|t| newest(&t, &self.current)),
        };
        let mut s = lock(&self.shared);
        s.checked_ms = now_ms;
        match found {
            Ok(Some(info)) => {
                s.error.clear();
                s.info = Some(info);
                s.phase = Phase::Available;
            }
            Ok(None) => {
                s.error.clear();
                s.info = None;
                s.phase = Phase::Idle;
            }
            Err(e) => {
                s.error = e;
                s.phase = if s.info.is_some() { Phase::Available } else { Phase::Error };
            }
        }
    }

    fn fetch(&self) {
        let info = {
            let mut s = lock(&self.shared);
            let Some(info) = s.info.clone() else { return };
            s.phase = Phase::Downloading;
            s.pct = 0;
            s.error.clear();
            info
        };
        let dir = self.net.dir();
        let _ = std::fs::create_dir_all(&dir);
        let part = dir.join("EyeTime-Setup.exe.part");
        let done = dir.join(format!("EyeTime-Setup-{}.exe", info.version));
        let _ = std::fs::remove_file(&part);
        let shared = self.shared.clone();
        let size = info.size.max(1);
        let r = self.net.download(&info.url, &part, &|bytes| lock(&shared).pct = ((bytes.min(size) * 100) / size).min(99) as u32);
        let verdict = r.and_then(|()| {
            let len = std::fs::metadata(&part).map(|m| m.len()).map_err(|e| e.to_string())?;
            if len > MAX_BYTES || len != info.size {
                return Err("the download is not the size that was announced".to_string());
            }
            let got = sha256_file(&part).map_err(|e| e.to_string())?;
            if !same_hash(&got, &info.sha256) {
                return Err("the download does not match its checksum, so it was thrown away".to_string());
            }
            let _ = std::fs::remove_file(&done);
            std::fs::rename(&part, &done).map_err(|e| e.to_string())
        });
        let mut s = lock(&self.shared);
        match verdict {
            Ok(()) => {
                s.pct = 100;
                s.path = Some(done);
                s.phase = Phase::Ready;
            }
            Err(e) => {
                let _ = std::fs::remove_file(&part);
                s.error = e;
                s.want_install = false;
                s.phase = Phase::Available;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    pub struct FakeNet {
        pub list: Mutex<Result<String, String>>,
        pub bytes: Mutex<Vec<u8>>,
        pub feed: Mutex<Option<String>>,
        pub dir: PathBuf,
        pub gets: AtomicUsize,
    }
    impl Net for FakeNet {
        fn get(&self, _url: &str) -> Result<String, String> {
            self.gets.fetch_add(1, Ordering::SeqCst);
            self.list.lock().unwrap().clone()
        }
        fn download(&self, _url: &str, dest: &Path, progress: &dyn Fn(u64)) -> Result<(), String> {
            let b = self.bytes.lock().unwrap().clone();
            progress(b.len() as u64 / 2);
            std::fs::write(dest, &b).map_err(|e| e.to_string())
        }
        fn local_feed(&self) -> Option<String> {
            self.feed.lock().unwrap().clone()
        }
        fn dir(&self) -> PathBuf {
            self.dir.clone()
        }
    }

    fn release_list(bytes: &[u8]) -> String {
        let sha = eyetime_core::update::sha256_hex(bytes);
        format!(
            r#"[{{"tag_name":"desktop-v0.2.0","draft":false,"prerelease":false,"body":"- One\n- Two","assets":[{{"name":"EyeTime-Setup.exe","browser_download_url":"{}desktop-v0.2.0/EyeTime-Setup.exe","size":{},"digest":"sha256:{sha}"}}]}}]"#,
            eyetime_core::update::ALLOWED_PREFIX,
            bytes.len()
        )
    }
    fn setup(bytes: &[u8], list: Result<String, String>) -> (Updater<FakeNet>, PathBuf) {
        let dir = std::env::temp_dir().join(format!("eyetime-upd-{}-{:?}", std::process::id(), std::thread::current().id()));
        let _ = std::fs::remove_dir_all(&dir);
        let net = FakeNet { list: Mutex::new(list), bytes: Mutex::new(bytes.to_vec()), feed: Mutex::new(None), dir: dir.clone(), gets: AtomicUsize::new(0) };
        (Updater::new(net, Arc::new(Mutex::new(Shared::default())), "0.1.0"), dir)
    }

    #[test]
    fn it_looks_on_its_own_then_waits_six_hours() {
        let b = b"installer".to_vec();
        let (u, _) = setup(&b, Ok(release_list(&b)));
        u.step(10_000_000);
        assert_eq!(lock(&u.shared).phase, Phase::Available);
        assert_eq!(lock(&u.shared).info.as_ref().unwrap().version, "0.2.0");
        u.step(10_000_000 + 3_600_000);
        assert_eq!(u.net.gets.load(Ordering::SeqCst), 1, "not again within six hours");
        u.step(10_000_000 + EVERY_MS + 1);
        assert_eq!(u.net.gets.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn nothing_is_fetched_until_it_is_wanted_and_then_it_is_checked() {
        let b = b"installer bytes".to_vec();
        let (u, dir) = setup(&b, Ok(release_list(&b)));
        u.step(1);
        assert_eq!(lock(&u.shared).phase, Phase::Available);
        assert!(!dir.join("EyeTime-Setup-0.2.0.exe").exists());
        lock(&u.shared).want_install = true;
        u.step(2);
        let s = lock(&u.shared);
        assert_eq!(s.phase, Phase::Ready);
        assert_eq!(s.pct, 100);
        assert_eq!(std::fs::read(s.path.as_ref().unwrap()).unwrap(), b);
    }

    #[test]
    fn a_download_that_is_not_what_was_announced_is_thrown_away() {
        let b = b"installer bytes".to_vec();
        let (u, dir) = setup(&b, Ok(release_list(&b)));
        u.step(1);
        *u.net.bytes.lock().unwrap() = b"tampered bytes!".to_vec(); // same length, other content
        lock(&u.shared).want_install = true;
        u.step(2);
        let s = lock(&u.shared);
        assert_eq!(s.phase, Phase::Available);
        assert!(s.error.contains("checksum"), "{}", s.error);
        assert!(!s.want_install);
        assert!(!dir.join("EyeTime-Setup-0.2.0.exe").exists() && !dir.join("EyeTime-Setup.exe.part").exists());
        drop(s);
        *u.net.bytes.lock().unwrap() = b"short".to_vec();
        lock(&u.shared).want_install = true;
        u.step(3);
        assert!(lock(&u.shared).error.contains("size"));
    }

    #[test]
    fn no_network_is_an_error_that_is_retried_soon_and_never_breaks_what_was_found() {
        let b = b"x".to_vec();
        let (u, _) = setup(&b, Err("offline".into()));
        u.step(0);
        assert_eq!(lock(&u.shared).phase, Phase::Error);
        assert_eq!(lock(&u.shared).error, "offline");
        *u.net.list.lock().unwrap() = Ok(release_list(&b));
        u.step(RETRY_MS - 1);
        assert_eq!(lock(&u.shared).phase, Phase::Error);
        u.step(RETRY_MS);
        assert_eq!(lock(&u.shared).phase, Phase::Available);
        // later the network is gone again: the update that is known stays known
        *u.net.list.lock().unwrap() = Err("offline".into());
        lock(&u.shared).want_check = true;
        u.step(RETRY_MS + 5);
        assert_eq!(lock(&u.shared).phase, Phase::Available);
    }

    #[test]
    fn a_local_feed_wins_over_the_network() {
        let b = b"abc".to_vec();
        let (u, _) = setup(&b, Err("must not be asked".into()));
        let sha = eyetime_core::update::sha256_hex(&b);
        *u.net.feed.lock().unwrap() = Some(format!(r#"{{"version":"0.5.0","url":"C:\\x.exe","sha256":"{sha}","size":3,"notes":["n"]}}"#));
        u.step(0);
        assert_eq!(lock(&u.shared).info.as_ref().unwrap().version, "0.5.0");
        assert_eq!(u.net.gets.load(Ordering::SeqCst), 0);
    }
}
