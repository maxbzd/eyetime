//! A pretend computer, for the tests and for the simulator that the screens are tried against on any machine.

use crate::os::{Os, Proc};
use std::io;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct World {
    pub wall: i64,
    pub mono: i64,
    pub hosts: String,
    pub hosts_writable: bool,
    pub procs: Vec<Proc>,
    pub killed: Vec<u32>,
    pub taskmgr: bool,
    pub awake: bool,
    pub doh: bool,
    pub safeboot: bool,
    pub store: Option<String>,
    pub dns_flushes: u32,
}

#[derive(Clone)]
pub struct Fake(pub Arc<Mutex<World>>);

impl Os for Fake {
    fn wall_ms(&self) -> i64 {
        self.0.lock().unwrap().wall
    }
    fn mono_ms(&self) -> i64 {
        self.0.lock().unwrap().mono
    }
    fn tz_offset_ms(&self) -> i64 {
        0
    }
    fn read_hosts(&self) -> io::Result<String> {
        Ok(self.0.lock().unwrap().hosts.clone())
    }
    fn write_hosts(&self, text: &str) -> io::Result<()> {
        let mut w = self.0.lock().unwrap();
        if !w.hosts_writable {
            return Err(io::Error::new(io::ErrorKind::PermissionDenied, "no"));
        }
        w.hosts = text.to_string();
        Ok(())
    }
    fn flush_dns(&self) {
        self.0.lock().unwrap().dns_flushes += 1;
    }
    fn processes(&self) -> Vec<Proc> {
        let w = self.0.lock().unwrap();
        w.procs.iter().filter(|p| !w.killed.contains(&p.pid)).cloned().collect()
    }
    fn terminate(&self, pid: u32) -> bool {
        self.0.lock().unwrap().killed.push(pid);
        true
    }
    fn own_pid(&self) -> u32 {
        1
    }
    fn set_taskmgr_locked(&self, on: bool) {
        self.0.lock().unwrap().taskmgr = on;
    }
    fn set_firefox_doh_off(&self, on: bool) {
        self.0.lock().unwrap().doh = on;
    }
    fn set_keep_awake(&self, on: bool) {
        self.0.lock().unwrap().awake = on;
    }
    fn set_safeboot(&self, on: bool) {
        self.0.lock().unwrap().safeboot = on;
    }
    fn in_safe_mode(&self) -> bool {
        false
    }
    fn read_store(&self) -> Option<String> {
        self.0.lock().unwrap().store.clone()
    }
    fn write_store(&self, text: &str) -> io::Result<()> {
        self.0.lock().unwrap().store = Some(text.to_string());
        Ok(())
    }
    fn log(&self, _line: &str) {}
}

