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
    fn terminate(&self, pid: u32) -> bool;
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
}
