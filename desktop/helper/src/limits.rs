//! Who may hold how many connections to the pipe, and for how long.
//!
//! The pipe is open to every signed-in person (the window and the agent run in their session), so any program they start can connect.
//! Without a limit it could open connections until the service has no threads left, or hold one open half way through a line. The
//! programs that are known by their real file (the window, the agent, the browser's host, the administrator's tools) get room and
//! no time limit; every other program gets a few connections and a few seconds.
//!
//! Plain logic, no Windows in it: the server asks `admit` for every new connection, `touch`es it after each request, and a thread asks
//! `cancel_overdue` now and then (what is cancelled is decided here, how is told by the caller).

use eyetime_core::ipc::Role;
use std::collections::HashMap;
use std::sync::Mutex;

/// at most this many connections at once from programs that are not known
pub const MAX_UNKNOWN: usize = 4;
/// at most this many connections at once in all
pub const MAX_TOTAL: usize = 64;
/// a connection of an unknown program that has not finished a request for this long is cut
pub const UNKNOWN_IDLE_MS: i64 = 10_000;

struct Conn {
    role: Role,
    /// the last moment this connection was admitted or finished a request (ms on the monotonic clock)
    last: i64,
    /// what the caller needs to cut it (the handle of the pipe)
    token: usize,
}

#[derive(Default)]
pub struct Limiter {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    next: u64,
    conns: HashMap<u64, Conn>,
}

impl Limiter {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// A new connection: its number, or `None` when this kind of client already has all the room it may have.
    pub fn admit(&self, role: Role, token: usize, now: i64) -> Option<u64> {
        let mut g = self.lock();
        let unknown = g.conns.values().filter(|c| c.role == Role::Other).count();
        if g.conns.len() >= MAX_TOTAL || (role == Role::Other && unknown >= MAX_UNKNOWN) {
            return None;
        }
        g.next += 1;
        let id = g.next;
        g.conns.insert(
            id,
            Conn {
                role,
                last: now,
                token,
            },
        );
        Some(id)
    }

    /// a request was answered on this connection
    pub fn touch(&self, id: u64, now: i64) {
        if let Some(c) = self.lock().conns.get_mut(&id) {
            c.last = now;
        }
    }

    /// the connection is over. Call it before the handle is closed: from then on nothing can be cut by a stale token.
    pub fn release(&self, id: u64) {
        self.lock().conns.remove(&id);
    }

    /// Calls `cut` with the token of every connection of an unknown program that has waited too long. The lock is held meanwhile, so a
    /// connection that is being released is either cut before it goes or not at all. Returns how many were cut.
    pub fn cancel_overdue(&self, now: i64, mut cut: impl FnMut(usize)) -> usize {
        let g = self.lock();
        let mut n = 0;
        for c in g.conns.values() {
            if c.role == Role::Other && now - c.last > UNKNOWN_IDLE_MS {
                cut(c.token);
                n += 1;
            }
        }
        n
    }

    pub fn open(&self) -> usize {
        self.lock().conns.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_programs_get_a_few_connections_and_no_more() {
        let l = Limiter::default();
        let ids: Vec<_> = (0..MAX_UNKNOWN)
            .map(|i| l.admit(Role::Other, i, 0).expect("room"))
            .collect();
        assert!(
            l.admit(Role::Other, 99, 0).is_none(),
            "the fifth is refused"
        );
        l.release(ids[0]);
        assert!(
            l.admit(Role::Other, 99, 0).is_some(),
            "room again after one leaves"
        );
    }

    #[test]
    fn a_flood_of_unknown_programs_does_not_shut_out_the_window_or_the_agent() {
        let l = Limiter::default();
        for i in 0..MAX_UNKNOWN {
            l.admit(Role::Other, i, 0).unwrap();
        }
        assert!(l.admit(Role::Other, 50, 0).is_none());
        assert!(l.admit(Role::Window, 51, 0).is_some());
        assert!(l.admit(Role::Agent, 52, 0).is_some());
        assert!(l.admit(Role::Admin, 53, 0).is_some());
    }

    #[test]
    fn nobody_gets_past_the_total() {
        let l = Limiter::default();
        for i in 0..MAX_TOTAL {
            assert!(l.admit(Role::Agent, i, 0).is_some());
        }
        assert!(l.admit(Role::Window, 1000, 0).is_none());
        assert_eq!(l.open(), MAX_TOTAL);
    }

    #[test]
    fn only_unknown_programs_are_cut_and_only_when_they_wait_too_long() {
        let l = Limiter::default();
        let slow = l.admit(Role::Other, 1, 0).unwrap();
        let busy = l.admit(Role::Other, 2, 0).unwrap();
        l.admit(Role::Window, 3, 0).unwrap();
        l.admit(Role::Agent, 4, 0).unwrap();
        l.touch(busy, UNKNOWN_IDLE_MS); // finished a request just now
        let mut cut = vec![];
        let n = l.cancel_overdue(UNKNOWN_IDLE_MS + 1, |t| cut.push(t));
        assert_eq!((n, cut), (1, vec![1]), "only the slow unknown one");
        // a known client that is quiet for an hour is left alone (it keeps its connection between requests)
        let mut cut = vec![];
        l.cancel_overdue(3_600_000, |t| cut.push(t));
        cut.sort();
        assert_eq!(cut, vec![1, 2], "the window and the agent are never cut");
        l.release(slow);
        let mut cut = vec![];
        l.cancel_overdue(3_600_000, |t| cut.push(t));
        assert_eq!(
            cut,
            vec![2],
            "a released connection cannot be cut by its old token"
        );
    }
}
