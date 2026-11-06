//! Everything the helper does to the computer, in one place. The real one is in `os_windows.rs`; the tests use a pretend one.

use std::io;

#[derive(Clone, Debug, PartialEq)]
pub struct Proc {
    pub pid: u32,
    pub exe: String,
}

pub trait Os: Send {
    /// system clock, ms since 1970 (UTC)
    fn wall_ms(&self) -> i64;
    /// monotonic clock that keeps counting while the computer sleeps
    fn mono_ms(&self) -> i64;
    /// how far local time is ahead of UTC right now
    fn tz_offset_ms(&self) -> i64;

    fn read_hosts(&self) -> io::Result<String>;
    fn write_hosts(&self, text: &str) -> io::Result<()>;
    fn flush_dns(&self);

    fn processes(&self) -> Vec<Proc>;
    /// Closes process `pid` by force, but only if it still is the program called `exe`: a process number can be handed to another program between
    /// the moment the list was read and the moment of closing, and that one must never be closed.
    fn terminate(&self, pid: u32, exe: &str) -> bool;
    fn own_pid(&self) -> u32;

    fn set_taskmgr_locked(&self, on: bool);
    fn set_firefox_doh_off(&self, on: bool);
    fn set_keep_awake(&self, on: bool);
    /// keep the service alive in Safe Mode too
    fn set_safeboot(&self, on: bool);
    fn in_safe_mode(&self) -> bool;

    fn read_store(&self) -> Option<String>;
    fn write_store(&self, text: &str) -> io::Result<()>;
    fn log(&self, line: &str);
    /// start the downloaded installer, detached (it stops this service and starts the new one)
    fn launch_update(&self, installer: &std::path::Path) -> io::Result<()>;
}

/// Writes `bytes` to `tmp`, forces them to the disk, then moves the file over `target`: a power cut leaves the old file or the new one,
/// never a half-written one and never a new name with nothing behind it (the setup, the emergency keys and the clock anchor live in such files).
pub fn write_durably(
    tmp: &std::path::Path,
    target: &std::path::Path,
    bytes: &[u8],
) -> io::Result<()> {
    use std::io::Write;
    let mut f = std::fs::File::create(tmp)?;
    f.write_all(bytes)?;
    f.sync_all()?;
    drop(f);
    std::fs::rename(tmp, target)
}

/// `C:\Program Files\App\app.exe` -> `app.exe` (the name a process is listed by)
pub fn image_file_name(path: &str) -> &str {
    path.rsplit(['\\', '/']).next().unwrap_or(path)
}

#[cfg(test)]
mod tests {
    use super::{image_file_name, write_durably};

    #[test]
    fn a_durable_write_replaces_the_file_and_leaves_no_temporary_behind() {
        let dir = std::env::temp_dir().join(format!("eyetime-durable-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (tmp, target) = (dir.join("x.json.tmp"), dir.join("x.json"));
        write_durably(&tmp, &target, b"one").unwrap();
        write_durably(&tmp, &target, b"two").unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"two");
        assert!(!tmp.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_file_name_is_what_follows_the_last_separator() {
        assert_eq!(
            image_file_name(r"C:\Program Files\Steam\steam.exe"),
            "steam.exe"
        );
        assert_eq!(image_file_name("steam.exe"), "steam.exe");
        assert_eq!(image_file_name("C:/x/y.exe"), "y.exe");
        assert_eq!(image_file_name(""), "");
    }
}
