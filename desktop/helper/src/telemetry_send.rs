// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! The network half of the optional anonymous numbers: when the supervisor says a report (or the request to forget an identifier) is due, post it, and say how it went.
//! The supervisor decides everything (consent, schedule, the text); this only carries it, outside the lock, because the network may be slow.

use crate::os::Os;
use crate::supervisor::Supervisor;
use std::sync::Mutex;

/// Posts a text as JSON and answers with the HTTP status. The Windows one is `WinNet`, the tests use a pretend one.
pub trait Post: Send + Sync {
    fn post_json(&self, url: &str, body: &str) -> Result<u16, String>;
}

/// One look: send what is due, if anything. Returns whether something was tried.
pub fn step<O: Os>(sup: &Mutex<Supervisor<O>>, post: &dyn Post, endpoint: &str) -> bool {
    let job = {
        let mut s = sup.lock().unwrap_or_else(|e| e.into_inner());
        s.telemetry_job(endpoint)
    };
    let Some(job) = job else {
        return false;
    };
    let status = post.post_json(&job.url, &job.body).ok(); // (the lock is not held while the network works)
    let mut s = sup.lock().unwrap_or_else(|e| e.into_inner());
    s.telemetry_done(&job, status);
    true
}
