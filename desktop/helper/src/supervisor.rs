//! The helper's brain. It owns the session, the PIN, the keys, the grants and the usage; the window can only ask.
//! Nothing here knows about Windows: it talks to the computer through `Os`, so all of it is tested with a pretend one.

use crate::os::Os;
use eyetime_core::catalog::{is_private_title, item_exes, never_close, BROWSERS, TOOLS_CLOSED_WHEN_FROZEN, VPN_AND_PROXY};
use eyetime_core::engine::{apply_cools, canonical_key, decide, hour_keys, is_distracting, Decision, Grants};
use eyetime_core::friction::{days_from_civil, civil_from_days, Challenge, Ledger, Pin, PinResult, Verdict};
use eyetime_core::hosts;
use eyetime_core::ipc::{challenge_data, BlockEvent, Fg, Orders, Request, Response, Status, Totals, UpdateView, Win};
use eyetime_core::update::Updated;
use crate::update::{Phase, Shared};
use std::sync::{Arc, Mutex};
use eyetime_core::model::{Item, Now, Session, State, KEYS};
use eyetime_core::tamper::{boot_time, loosens, unsafe_setup, ClockGuard, MAX_FROZEN_MIN};
use eyetime_core::usage::Usage;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, VecDeque};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
/// how long a program gets to close by itself (and offer to save) before it is closed by force
pub const GRACE_MS: i64 = 15_000;
pub const GRACE_FROZEN_MS: i64 = 8_000;
pub const MAX_SESSION_MIN: u32 = 24 * 60;
const FRESH_MS: i64 = 10_000;
const AWAY_SECS: u32 = 180;

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Persist {
    pub keys: HashMap<String, Value>,
    pub session: Option<Session>,
    pub usage: Usage,
    pub grants: Grants,
    pub ledger: Ledger,
    pub pin: Pin,
    pub partner: Pin,
    pub emergency_until_ms: i64,
    pub uninstall_ok_until_ms: i64,
    pub unblocks: BTreeMap<String, u32>,
    pub streak: u32,
    pub streak_day: String,
    /// minutes of focus sessions finished, by day
    pub focus: BTreeMap<String, u32>,
    pub totals: Totals,
    pub last_seen_ms: i64,
    /// automatic updates are on unless this is set
    pub auto_off: bool,
    /// the update that was started and has not been seen to finish
    pub pending_update: Option<Updated>,
    pub relaunch_app: bool,
    /// an update that was just installed, until the window has shown what is new
    pub updated: Option<Updated>,
}

struct Pending {
    ch: Challenge,
    target: Option<String>,
    minutes: u32,
}

#[derive(Default)]
struct Applied {
    hosts: Vec<String>,
    taskmgr: bool,
    keep_awake: bool,
    doh: bool,
    safeboot: Option<bool>,
}

pub struct Supervisor<O: Os> {
    pub os: O,
    pub p: Persist,
    pub state: State,
    pub decision: Decision,
    clock: ClockGuard,
    pending: Vec<Pending>,
    obs: Option<(Vec<Win>, Option<Fg>, u32, bool, i64)>,
    site: Option<(String, bool, i64)>,
    last_tick: i64,
    /// the program that was in front at the last look (for "when this program opens")
    auto_prev: Option<String>,
    /// when each automation last started something
    auto_fired: HashMap<String, i64>,
    last_trusted: i64,
    events: VecDeque<BlockEvent>,
    last_event: HashMap<String, i64>,
    applied: Applied,
    hosts_ok: bool,
    pub upd: Arc<Mutex<Shared>>,
    closing: HashMap<u32, i64>,
    dirty: bool,
    last_save: i64,
    tz: i64,
    orders: Orders,
}

fn lower(s: &str) -> String {
    s.trim().to_lowercase()
}

impl<O: Os> Supervisor<O> {
    pub fn new(os: O) -> Supervisor<O> {
        let p: Persist = os.read_store().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
        let state = State::from_keys(&p.keys);
        let (wall, mono) = (os.wall_ms(), os.mono_ms());
        let floor = boot_time(wall, p.last_seen_ms);
        let mut s = Supervisor {
            os,
            p,
            state,
            decision: Decision::default(),
            clock: ClockGuard::default(),
            pending: Vec::new(),
            obs: None,
            site: None,
            last_tick: floor,
            auto_prev: None,
            auto_fired: HashMap::new(),
            last_trusted: floor,
            events: VecDeque::new(),
            last_event: HashMap::new(),
            applied: Applied::default(),
            hosts_ok: true,
            upd: Arc::new(Mutex::new(Shared::default())),
            closing: HashMap::new(),
            dirty: false,
            last_save: 0,
            tz: 0,
            orders: Orders::default(),
        };
        // a session that is still running after a restart keeps running, and the clock cannot have gone back
        if wall < s.p.last_seen_ms {
            s.clock.set_anchor(s.p.last_seen_ms - mono);
        }
        s.tz = s.os.tz_offset_ms();
        let now = Now::from_local(floor, s.tz);
        s.recompute(floor, &now);
        s.settle_update();
        s
    }

    // ---------- time ----------

    fn time(&mut self) -> (i64, Now) {
        let (wall, mono) = (self.os.wall_ms(), self.os.mono_ms());
        let locked = self.decision.locked() && self.p.emergency_until_ms <= self.last_trusted;
        let trusted = if self.state.protect.tam.clock || locked { self.clock.trusted_ms(wall, mono, locked) } else { wall };
        let trusted = trusted.max(self.last_trusted); // never backwards inside one run
        self.last_trusted = trusted;
        (trusted, Now::from_local(trusted, self.tz))
    }

    fn yesterday(day: &str) -> String {
        match days_from_civil(day) {
            Some(d) => {
                let (y, m, dd) = civil_from_days(d - 1);
                format!("{y:04}-{m:02}-{dd:02}")
            }
            None => String::new(),
        }
    }

    // ---------- the tick ----------

    /// Called every couple of seconds.
    pub fn tick(&mut self) {
        self.tz = self.os.tz_offset_ms();
        let (t, now) = self.time();
        if self.p.totals.since_day.is_empty() {
            self.p.totals.since_day = now.day.clone();
            self.dirty = true;
        }
        let dt_ms = (t - self.last_tick).clamp(0, 30_000);
        self.last_tick = t;

        // what is in front
        let key = self.foreground_key(t);
        let dt = ((dt_ms + 500) / 1000) as u32;
        let hk = hour_keys(&self.state);
        let key = key.map(|k| canonical_key(&self.state, &k));
        self.p.usage.tick(&now, key.as_deref(), dt, &hk);
        if key.as_deref().map(|k| is_distracting(&self.state, k)).unwrap_or(false) {
            self.p.usage.mark_distracting(&now, dt);
        }
        apply_cools(&mut self.p.usage, &self.state, &now);

        self.p.grants.prune(t);
        self.p.unblocks.retain(|d, _| *d == now.day);
        self.expire_session(t, &now);
        self.p.last_seen_ms = t;

        self.recompute(t, &now);
        self.enforce(t, &now);
        self.update_tick(t);

        if self.dirty || t - self.last_save > 30_000 {
            self.save(t);
        }
    }

    fn foreground_key(&self, t: i64) -> Option<String> {
        let (_, fg, idle, locked, at) = self.obs.as_ref()?;
        if t - at > FRESH_MS || *locked || *idle >= AWAY_SECS {
            return None;
        }
        let fg = fg.as_ref()?;
        let exe = lower(&fg.exe);
        if exe.is_empty() || never_close(&exe) && exe != "explorer.exe" {
            return None;
        }
        if BROWSERS.contains(&exe.as_str()) {
            if let Some((host, _, sat)) = &self.site {
                if t - sat <= FRESH_MS && !host.is_empty() {
                    return Some(format!("site:{host}"));
                }
            }
        }
        if exe == "explorer.exe" {
            return None; // the desktop is nobody's time
        }
        Some(format!("exe:{exe}"))
    }

    fn expire_session(&mut self, t: i64, now: &Now) {
        let Some(s) = self.p.session.clone() else { return };
        if s.ends_at_ms > t {
            return;
        }
        // finished by itself: counts for the streak and the focus minutes
        let mins = ((s.ends_at_ms - s.started_at_ms) / 60_000).max(0) as u32;
        *self.p.focus.entry(now.day.clone()).or_insert(0) += mins;
        self.p.totals.focus_min += mins as u64;
        self.p.totals.sessions += 1;
        while self.p.focus.len() > 35 {
            let first = self.p.focus.keys().next().cloned().unwrap();
            self.p.focus.remove(&first);
        }
        if self.p.streak_day != now.day {
            self.p.streak = if self.p.streak_day == Self::yesterday(&now.day) { self.p.streak + 1 } else { 1 };
            self.p.streak_day = now.day.clone();
        }
        self.p.totals.best_streak = self.p.totals.best_streak.max(self.p.streak);
        self.p.session = None;
        self.dirty = true;
    }

    fn recompute(&mut self, t: i64, now: &Now) {
        self.decision = if self.p.emergency_until_ms > t {
            Decision::default()
        } else {
            decide(&self.state, now, &self.p.usage, self.p.session.as_ref(), &self.p.grants)
        };
        let ses = self.p.session.as_ref().filter(|s| s.ends_at_ms > t && self.p.emergency_until_ms <= t);
        let close_pids = std::mem::take(&mut self.orders.close_pids);
        self.orders = Orders { close_private: self.decision.close_private, mute: ses.map(|s| s.mute).unwrap_or(false), dnd: ses.map(|s| s.dnd).unwrap_or(false), close_pids, launch_app: false };
    }

    // ---------- carrying it out ----------

    fn event(&mut self, t: i64, kind: &str, name: &str, reason: &str) {
        let k = format!("{kind}:{name}");
        if self.last_event.get(&k).map(|l| t - l < 5_000).unwrap_or(false) {
            return;
        }
        self.last_event.insert(k, t);
        self.events.push_back(BlockEvent { at_ms: t, kind: kind.into(), name: name.into(), reason: reason.into() });
        while self.events.len() > 30 {
            self.events.pop_front();
        }
    }

    fn enforce(&mut self, t: i64, _now: &Now) {
        let d = self.decision.clone();
        let tam = self.state.protect.tam.clone();
        let reason = d.reasons.first().map(|r| r.name.clone()).unwrap_or_default();

        // 1. the hosts file
        let desired: Vec<String> = if d.active() { d.domains.clone() } else { Vec::new() };
        if tam.hosts || desired != self.applied.hosts {
            let cur = self.os.read_hosts().unwrap_or_default();
            if !hosts::is_current(&cur, &desired) {
                let restored = !desired.is_empty() && desired == self.applied.hosts;
                match self.os.write_hosts(&hosts::render(&cur, &desired)) {
                    Ok(()) => {
                        self.hosts_ok = true;
                        self.os.flush_dns();
                        if restored {
                            self.event(t, "tool", "hosts", "restored");
                        }
                    }
                    Err(e) => {
                        self.hosts_ok = false;
                        self.os.log(&format!("hosts: {e}"));
                    }
                }
            }
            self.applied.hosts = desired;
        }

        // 2. programs
        let mut doomed: Vec<(u32, String, &str)> = Vec::new();
        if d.active() || d.block_vpn || d.close_tools {
            let own = self.os.own_pid();
            for pr in self.os.processes() {
                let e = lower(&pr.exe);
                if pr.pid == own || pr.pid == 0 || never_close(&e) {
                    continue;
                }
                if d.exes.contains(&e) {
                    doomed.push((pr.pid, e, "app"));
                } else if d.block_vpn && VPN_AND_PROXY.contains(&e.as_str()) {
                    doomed.push((pr.pid, e, "vpn"));
                } else if d.close_tools && TOOLS_CLOSED_WHEN_FROZEN.contains(&e.as_str()) {
                    doomed.push((pr.pid, e, "tool"));
                }
            }
            if d.allow_only {
                if let Some((wins, _, _, _, at)) = &self.obs {
                    if t - at <= FRESH_MS {
                        for w in wins {
                            let e = lower(&w.exe);
                            if w.pid != own && w.pid != 0 && !e.is_empty() && d.blocks_exe(&e) && !doomed.iter().any(|x| x.0 == w.pid) {
                                doomed.push((w.pid, e, "app"));
                            }
                        }
                    }
                }
            }
        }
        // programs are asked to close first, so that they can offer to save; only what is still there after the grace time is closed by force
        let grace = if d.level >= 3 { GRACE_FROZEN_MS } else { GRACE_MS };
        let mut ask: Vec<u32> = Vec::new();
        let live: Vec<u32> = doomed.iter().map(|x| x.0).collect();
        self.closing.retain(|pid, _| live.contains(pid));
        for (pid, exe, kind) in doomed {
            if kind == "tool" {
                if self.os.terminate(pid) {
                    self.event(t, kind, &exe, &reason);
                }
                continue;
            }
            let since = *self.closing.entry(pid).or_insert(t);
            if since == t {
                self.event(t, "closing", &exe, &reason);
            }
            if t - since >= grace {
                if self.os.terminate(pid) {
                    self.event(t, kind, &exe, &reason);
                }
                self.closing.remove(&pid);
            } else {
                ask.push(pid);
            }
        }
        self.orders.close_pids = ask;

        // 3. system switches, only when they change
        let want_tm = d.lock_taskmgr;
        if want_tm != self.applied.taskmgr {
            self.os.set_taskmgr_locked(want_tm);
            self.applied.taskmgr = want_tm;
        }
        let want_awake = d.keep_awake;
        if want_awake != self.applied.keep_awake {
            self.os.set_keep_awake(want_awake);
            self.applied.keep_awake = want_awake;
        }
        let want_doh = d.active() && tam.hosts && !d.domains.is_empty();
        if want_doh != self.applied.doh {
            self.os.set_firefox_doh_off(want_doh);
            self.applied.doh = want_doh;
        }
        if self.applied.safeboot != Some(tam.safemode) {
            self.os.set_safeboot(tam.safemode);
            self.applied.safeboot = Some(tam.safemode);
        }
        if self.clock.tampered() && self.decision.locked() {
            self.event(t, "tool", "clock", "moved");
        }
    }

    fn save(&mut self, t: i64) {
        match serde_json::to_string(&self.p) {
            Ok(text) => {
                if let Err(e) = self.os.write_store(&text) {
                    self.os.log(&format!("save: {e}"));
                } else {
                    self.dirty = false;
                    self.last_save = t;
                }
            }
            Err(e) => self.os.log(&format!("save: {e}")),
        }
    }

    /// The service is stopping: put the computer back as it was, so that nothing stays closed by accident.
    pub fn shutdown(&mut self, keep_blocks: bool) {
        let t = self.last_trusted;
        self.save(t);
        if !keep_blocks {
            let cur = self.os.read_hosts().unwrap_or_default();
            if !hosts::is_current(&cur, &[]) {
                let _ = self.os.write_hosts(&hosts::render(&cur, &[]));
                self.os.flush_dns();
            }
            self.os.set_taskmgr_locked(false);
            self.os.set_keep_awake(false);
            self.os.set_firefox_doh_off(false);
        }
    }

    // ---------- automations ----------

    /// "When this program opens, start a session": the only kind of automation that is carried out, and only a normal one
    /// (it can be paused or ended), so that nothing can lock the person in without their asking for it.
    fn auto_watch(&mut self, t: i64) {
        let exe = self.obs.as_ref().and_then(|o| o.1.as_ref()).map(|f| f.exe.to_lowercase());
        if exe == self.auto_prev {
            return;
        }
        self.auto_prev = exe.clone();
        let Some(exe) = exe else { return };
        if self.p.session.as_ref().map(|s| s.ends_at_ms > t).unwrap_or(false) {
            return;
        }
        let todo: Vec<(String, String, u32)> = self
            .state
            .auto
            .iter()
            .filter(|a| a.on && a.when == "app" && a.then == "start" && !a.wv.trim().is_empty())
            .filter(|a| item_exes(&Item { name: a.wv.clone(), kind: "app".into(), ..Default::default() }).contains(&exe))
            .filter(|a| self.auto_fired.get(&a.id).map(|at| t - at > 60 * 60_000).unwrap_or(true))
            .map(|a| {
                let minutes = a.tv.split(|c: char| !c.is_ascii_digit()).find(|p| !p.is_empty()).and_then(|p| p.parse::<u32>().ok()).unwrap_or(25).clamp(1, 240);
                let name = a.tv.split(',').next().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "Focus".into());
                (a.id.clone(), name, minutes)
            })
            .collect();
        if let Some((id, name, minutes)) = todo.into_iter().next() {
            let blocks: Vec<String> = self.state.items.iter().filter(|i| i.g == "dis").map(|i| i.name.clone()).collect();
            let r = self.handle(Request::StartSession { name, minutes, level: 0, blocks, scene: String::new(), allow_breaks: true, dnd: false, mute: false, close_now: false });
            if r.ok {
                self.auto_fired.insert(id, t);
            }
        }
    }

    // ---------- updates ----------

    /// After a start: did the update that was begun really finish? If so, the window gets to say what is new; if not, it is told.
    fn settle_update(&mut self) {
        if let Some(p) = self.p.pending_update.take() {
            self.p.uninstall_ok_until_ms = 0; // the permission was only for the installer that has now run
            if p.to == VERSION {
                self.p.updated = Some(p);
            } else {
                self.p.relaunch_app = false;
                let mut s = self.upd.lock().unwrap_or_else(|e| e.into_inner());
                s.error = "The update did not finish. Nothing was changed.".into();
            }
            self.dirty = true;
        }
    }

    pub fn stopping_for_update(&self) -> bool {
        self.p.pending_update.is_some()
    }

    fn update_view(&self, t: i64) -> UpdateView {
        let s = self.upd.lock().unwrap_or_else(|e| e.into_inner());
        UpdateView {
            state: s.phase.name().into(),
            current: VERSION.into(),
            info: s.info.clone(),
            pct: s.pct,
            error: s.error.clone(),
            checked_ago_ms: if s.checked_ms > 0 { (self.os.mono_ms() - s.checked_ms).max(0) } else { -1 },
            auto: !self.p.auto_off,
            waiting_for_lock: s.want_install && s.phase != Phase::Installing && self.locked_now(t),
            updated: self.p.updated.clone(),
        }
    }

    /// The new installer is run when it is there, wanted, and nothing locked is running. Manually asked: whenever that is.
    /// By itself: only when nothing is being blocked, so that it never lands in the middle of work.
    fn update_tick(&mut self, t: i64) {
        // an installer that was started and never finished (the service is still here after the permission ran out): say so, and allow a new try
        if self.p.pending_update.is_some() && t > self.p.uninstall_ok_until_ms {
            self.p.pending_update = None;
            self.p.relaunch_app = false;
            self.dirty = true;
            let mut s = self.upd.lock().unwrap_or_else(|e| e.into_inner());
            s.error = "The update did not finish. Nothing was changed.".into();
            s.want_install = false;
            s.manual = false;
            s.phase = Phase::Available;
        }
        if self.p.pending_update.is_some() {
            return;
        }
        let (phase, want, manual, info, path) = {
            let mut s = self.upd.lock().unwrap_or_else(|e| e.into_inner());
            if s.phase == Phase::Available && !self.p.auto_off && !s.want_install {
                s.want_install = true; // fetch in the background
            }
            (s.phase, s.want_install, s.manual, s.info.clone(), s.path.clone())
        };
        if phase != Phase::Ready || !want || self.locked_now(t) {
            return;
        }
        let idle = self.p.session.as_ref().map(|s| s.ends_at_ms <= t).unwrap_or(true) && !self.decision.active();
        if !manual && !idle {
            return;
        }
        let (Some(info), Some(path)) = (info, path) else { return };
        self.p.pending_update = Some(Updated { from: VERSION.into(), to: info.version.clone(), notes: info.notes.clone() });
        // the window comes back after the update if the person asked for it, or if it was open
        let window_open = self.obs.as_ref().map(|o| o.0.iter().any(|w| w.exe.eq_ignore_ascii_case("eyetime.exe"))).unwrap_or(false);
        self.p.relaunch_app = manual || window_open;
        self.p.uninstall_ok_until_ms = t + 10 * 60_000; // the service is allowed to be stopped by the installer it is starting
        self.save(t);
        match self.os.launch_update(&path) {
            Ok(()) => self.upd.lock().unwrap_or_else(|e| e.into_inner()).phase = Phase::Installing,
            Err(e) => {
                self.p.pending_update = None;
                self.p.relaunch_app = false;
                self.p.uninstall_ok_until_ms = 0;
                let mut s = self.upd.lock().unwrap_or_else(|e| e.into_inner());
                s.error = format!("The installer could not be started: {e}");
                s.want_install = false;
                s.manual = false;
                s.phase = Phase::Available;
            }
        }
    }

    // ---------- requests ----------

    fn status(&mut self) -> Status {
        let (t, now) = self.time();
        let emergency_left = self.p.ledger.clone().left(&self.state.protect, &now.day);
        let mut focus: Vec<u32> = Vec::new();
        if let Some(today) = days_from_civil(&now.day) {
            for i in (0..35).rev() {
                let (y, m, d) = civil_from_days(today - i);
                focus.push(self.p.focus.get(&format!("{y:04}-{m:02}-{d:02}")).copied().unwrap_or(0));
            }
        }
        Status {
            version: VERSION.into(),
            now_ms: t,
            decision: self.decision.clone(),
            session: self.p.session.clone().filter(|s| s.ends_at_ms > t),
            grants: self.p.grants.clone(),
            today: self.p.usage.today(&now),
            emergency_left,
            emergency_total: self.p.ledger.total,
            pin_set: self.p.pin.is_set(),
            partner_set: self.p.partner.is_set(),
            clock_tampered: self.clock.tampered(),
            safe_mode_guard: self.state.protect.tam.safemode,
            hosts_ok: self.hosts_ok,
            frozen_limit_ms: self.p.session.as_ref().filter(|s| s.level >= 3 && s.ends_at_ms > t).map(|s| s.ends_at_ms),
            streak_days: if self.p.streak_day == now.day || self.p.streak_day == Self::yesterday(&now.day) { self.p.streak } else { 0 },
            events: self.events.iter().cloned().collect(),
            agent_connected: self.obs.as_ref().map(|o| t - o.4 <= FRESH_MS).unwrap_or(false),
            ext_connected: self.site.as_ref().map(|s| t - s.2 <= 30_000).unwrap_or(false),
            emergency_until_ms: self.p.emergency_until_ms,
            focus_minutes: focus,
            totals: self.p.totals.clone(),
            update: self.update_view(t),
        }
    }

    fn locked_now(&self, t: i64) -> bool {
        self.decision.locked() && self.p.emergency_until_ms <= t
    }

    fn check_pin(&mut self, which_partner: bool, pin: Option<&str>, t: i64) -> Result<(), Response> {
        let slot = if which_partner { &mut self.p.partner } else { &mut self.p.pin };
        if !slot.is_set() {
            return Ok(());
        }
        let r = slot.verify(pin.unwrap_or(""), t);
        self.dirty = true;
        match r {
            PinResult::Ok | PinResult::NotSet => Ok(()),
            PinResult::Locked(ms) => Err(Response::err_with("pin_locked", "Too many wrong tries", ms)),
            PinResult::Wrong { fails, locked_for_ms } => Err(Response::err_with("pin", "Wrong PIN", serde_json::json!({"fails": fails, "lockedForMs": locked_for_ms}))),
        }
    }

    pub fn handle(&mut self, req: Request) -> Response {
        let (t, now) = self.time();
        match req {
            Request::Ping => Response::ok(serde_json::json!({"version": VERSION})),
            Request::Status => Response::ok(self.status()),
            Request::Decision => Response::ok(&self.decision),
            Request::Usage => Response::ok(&self.p.usage.days),
            Request::Resume => {
                if let Some(s) = self.p.session.as_mut() {
                    s.snooze_until_ms = None;
                }
                self.p.grants = Grants::default();
                self.dirty = true;
                self.recompute(t, &now);
                Response::ok(self.status())
            }
            Request::GetState => Response::ok(&self.p.keys),

            Request::Observe { fg, idle_secs, windows, screen_locked } => {
                self.obs = Some((windows, fg, idle_secs, screen_locked, t));
                self.auto_watch(t);
                let mut o = self.orders.clone();
                if self.p.relaunch_app && self.p.pending_update.is_none() {
                    o.launch_app = true; // once: the window comes back after an update
                    self.p.relaunch_app = false;
                    self.dirty = true;
                }
                Response::ok(&o)
            }
            Request::UpdateCheck => {
                self.upd.lock().unwrap_or_else(|e| e.into_inner()).want_check = true;
                Response::ok(self.update_view(t))
            }
            Request::UpdateInstall => {
                {
                    let mut s = self.upd.lock().unwrap_or_else(|e| e.into_inner());
                    if !matches!(s.phase, Phase::Available | Phase::Ready | Phase::Downloading | Phase::Installing) {
                        return Response::err("none", "There is no update to install");
                    }
                    s.want_install = true;
                    s.manual = true;
                }
                self.update_tick(t);
                Response::ok(self.update_view(t))
            }
            Request::UpdateSetAuto { on } => {
                self.p.auto_off = !on;
                self.dirty = true;
                Response::ok(self.update_view(t))
            }
            Request::UpdateAck => {
                self.p.updated = None;
                self.dirty = true;
                Response::done()
            }
            Request::Site { host, incognito, browser: _ } => {
                let h = host.as_deref().map(lower).unwrap_or_default();
                let h = h.trim_start_matches("www.").to_string();
                self.site = Some((h.clone(), incognito, t));
                let blocked = !h.is_empty() && self.decision.active() && self.decision.blocks_host(&h);
                Response::ok(serde_json::json!({"blocked": blocked, "incognito": incognito && self.decision.close_private}))
            }

            Request::SetState { keys, pin } => {
                let mut merged = self.p.keys.clone();
                for (k, v) in keys {
                    if !KEYS.contains(&k.as_str()) {
                        continue;
                    }
                    if v.to_string().len() > 512 * 1024 {
                        return Response::err("bad_request", format!("{k} is too big"));
                    }
                    merged.insert(k, v);
                }
                let new_state = State::from_keys(&merged);
                let trap = unsafe_setup(&new_state);
                if !trap.is_empty() && unsafe_setup(&self.state).is_empty() {
                    return Response::err_with("no_escape", "Locked rules need an emergency key a week, and frozen ones at most 8 hours", trap);
                }
                let weaker = loosens(&self.state, &new_state);
                if !weaker.is_empty() {
                    if self.locked_now(t) {
                        return Response::err_with("locked", "A locked block is running: it cannot be loosened", weaker);
                    }
                    if self.state.protect.pin_on && self.p.pin.is_set() {
                        if let Err(e) = self.check_pin(false, pin.as_deref(), t) {
                            return e;
                        }
                    }
                }
                self.p.keys = merged;
                self.state = new_state;
                self.dirty = true;
                self.recompute(t, &now);
                Response::done()
            }

            Request::StartSession { name, minutes, level, blocks, scene, allow_breaks, dnd, mute, close_now } => {
                if self.p.session.as_ref().map(|s| s.ends_at_ms > t).unwrap_or(false) {
                    return Response::err("busy", "A session is already running");
                }
                let level = level.min(3);
                if level >= 2 && !(self.state.protect.emerg >= 1 && self.state.protect.emerg_week >= 1) {
                    return Response::err("no_escape", "A locked session needs at least one emergency key a week");
                }
                let cap = if level >= 3 { MAX_FROZEN_MIN } else { MAX_SESSION_MIN };
                if minutes == 0 || minutes > cap || blocks.len() > 100 || name.len() > 80 {
                    return Response::err("bad_request", format!("Length must be 1 to {cap} minutes"));
                }
                let s = Session { id: format!("s{t}"), name, started_at_ms: t, ends_at_ms: t + minutes as i64 * 60_000, level, blocks, scene, allow_breaks: allow_breaks && level < 2, snooze_until_ms: None, close_now, dnd, mute };
                self.p.session = Some(s);
                self.p.emergency_until_ms = 0;
                self.dirty = true;
                self.recompute(t, &now);
                self.enforce(t, &now);
                Response::ok(self.status())
            }

            Request::Challenge { action, target, minutes } => self.challenge(&action, target, minutes.unwrap_or(5), t, &now),
            Request::Complete { challenge_id, answer, pin, partner_code } => self.complete(&challenge_id, &answer, pin, partner_code, t, &now),

            Request::SetPin { old, new } => self.set_pin(false, old, new, t),
            Request::SetPartnerPin { old, new } => self.set_pin(true, old, new, t),

            Request::Uninstall { pin: _ } => {
                if self.locked_now(t) {
                    return Response::err("locked", "A locked block is running");
                }
                if self.state.protect.tam.uninstall && self.p.uninstall_ok_until_ms <= t {
                    return Response::err("challenge", "Ask for permission first");
                }
                // the setup program stops the service next: that is allowed for a couple of minutes
                self.p.uninstall_ok_until_ms = self.p.uninstall_ok_until_ms.max(t + 120_000);
                self.dirty = true;
                Response::done()
            }
        }
    }

    fn set_pin(&mut self, partner: bool, old: Option<String>, new: String, t: i64) -> Response {
        if self.decision.locked() && self.p.emergency_until_ms <= t {
            return Response::err("locked", "A locked block is running");
        }
        if let Err(e) = self.check_pin(partner, old.as_deref(), t) {
            return e;
        }
        let slot = if partner { &mut self.p.partner } else { &mut self.p.pin };
        if new.is_empty() {
            *slot = Pin::default();
        } else {
            match Pin::set(&new, (t as u64) ^ (self.os.mono_ms() as u64).rotate_left(21)) {
                Some(p) => *slot = p,
                None => return Response::err("bad_request", "4 to 12 digits"),
            }
        }
        self.dirty = true;
        Response::done()
    }

    fn challenge(&mut self, action: &str, target: Option<String>, minutes: u32, t: i64, now: &Now) -> Response {
        let locked = self.locked_now(t);
        let session = self.p.session.clone().filter(|s| s.ends_at_ms > t);
        let mut minutes = minutes.clamp(1, 60);
        match action {
            "end_session" => match &session {
                None => return Response::err("none", "No session is running"),
                Some(s) if s.level >= 2 && self.p.emergency_until_ms <= t => return Response::err("locked", "This session cannot be ended. Only an emergency key opens it"),
                _ => {}
            },
            "break" => match &session {
                Some(s) if s.level < 2 && s.allow_breaks => minutes = minutes.min(15),
                Some(_) => return Response::err("locked", "This session has no breaks"),
                None => return Response::err("none", "No session is running"),
            },
            "unblock" => {
                let id = target.clone().unwrap_or_default();
                if id != "all" {
                    if let Some(r) = self.state.rules.iter().find(|r| r.id == id) {
                        if r.level >= 2 {
                            return Response::err("locked", "This rule is locked");
                        }
                    } else if !self.state.limits.iter().any(|l| l.id == id) {
                        return Response::err("bad_request", "Unknown rule or limit");
                    }
                }
                if locked && id == "all" && self.decision.level >= 2 {
                    return Response::err("locked", "A locked block is running");
                }
                minutes = minutes.min(30);
            }
            "emergency" => {
                if !locked && session.is_none() {
                    return Response::err("none", "Nothing is locked");
                }
                if self.p.ledger.clone().left(&self.state.protect, &now.day) == 0 {
                    return Response::err("no_keys", "No emergency keys left");
                }
                minutes = 30;
            }
            "uninstall" => {
                if locked {
                    return Response::err("locked", "A locked block is running");
                }
            }
            _ => return Response::err("bad_request", "Unknown action"),
        }
        self.pending.retain(|p| p.ch.expires_ms > t);
        self.pending.retain(|p| p.ch.action != action || p.target != target);
        if self.pending.len() >= 8 {
            self.pending.remove(0);
        }
        let used = self.p.unblocks.get(&now.day).copied().unwrap_or(0);
        let seed = (t as u64) ^ (self.os.mono_ms() as u64).rotate_left(17) ^ (self.pending.len() as u64) << 40;
        let mut protect = self.state.protect.clone();
        // emergency and uninstall are never easier than "hold"
        if matches!(action, "emergency" | "uninstall") && matches!(protect.friction.as_str(), "none") {
            protect.friction = "hold".into();
        }
        // a Normal session can be left or paused at any time, that is what Normal means
        if matches!(action, "end_session" | "break") && session.as_ref().map(|s| s.level == 0).unwrap_or(false) {
            protect.friction = "none".into();
            protect.pin_on = false;
        }
        let ch = Challenge::new(&protect, action, t, seed, used);
        let data = challenge_data(&ch);
        self.pending.push(Pending { ch, target, minutes });
        Response::ok(data)
    }

    fn complete(&mut self, id: &str, answer: &str, pin: Option<String>, partner_code: Option<String>, t: i64, now: &Now) -> Response {
        let Some(idx) = self.pending.iter().position(|p| p.ch.id == id) else { return Response::err("expired", "Ask again") };
        match self.pending[idx].ch.check(answer, t) {
            Verdict::Ok => {}
            Verdict::TooEarly(ms) => return Response::err_with("early", "Not yet", ms),
            Verdict::Wrong => return Response::err("wrong", "Not right"),
            Verdict::Expired => {
                self.pending.remove(idx);
                return Response::err("expired", "Ask again");
            }
        }
        if self.pending[idx].ch.kind == "friend" {
            if !self.p.partner.is_set() {
                return Response::err("bad_request", "No partner code is set");
            }
            if let Err(e) = self.check_pin(true, partner_code.as_deref(), t) {
                return e;
            }
        }
        if self.pending[idx].ch.needs_pin {
            if let Err(e) = self.check_pin(false, pin.as_deref(), t) {
                return e;
            }
        }
        let p = self.pending.remove(idx);
        let action = p.ch.action.clone();
        let mins = p.minutes as i64;
        match action.as_str() {
            "end_session" => {
                if self.state.protect.reset_streak {
                    self.p.streak = 0;
                }
                self.p.session = None;
            }
            "break" => {
                if let Some(s) = self.p.session.as_mut() {
                    s.snooze_until_ms = Some(t + mins * 60_000);
                }
                *self.p.unblocks.entry(now.day.clone()).or_insert(0) += 1;
            }
            "unblock" => {
                let id = p.target.unwrap_or_default();
                if id == "all" {
                    self.p.grants.all_until_ms = t + mins * 60_000;
                } else {
                    self.p.grants.ids.insert(id, t + mins * 60_000);
                }
                *self.p.unblocks.entry(now.day.clone()).or_insert(0) += 1;
            }
            "emergency" => {
                let protect = self.state.protect.clone();
                if !self.p.ledger.spend(&protect, &now.day) {
                    return Response::err("no_keys", "No emergency keys left");
                }
                self.p.emergency_until_ms = t + mins * 60_000;
                if self.state.protect.reset_streak {
                    self.p.streak = 0;
                }
                self.p.session = None;
            }
            "uninstall" => self.p.uninstall_ok_until_ms = t + 10 * 60_000,
            _ => {}
        }
        self.dirty = true;
        self.recompute(t, now);
        self.enforce(t, now);
        Response::ok(self.status())
    }

    /// Does the agent in the person's session report in?
    pub fn agent_alive(&self) -> bool {
        self.obs.as_ref().map(|o| self.last_trusted - o.4 <= FRESH_MS).unwrap_or(false)
    }

    /// May the service be stopped right now? Not during a locked block, and with the watchdog on only after the uninstall permission.
    pub fn may_stop(&self) -> bool {
        if self.locked_now(self.last_trusted) {
            return false;
        }
        !self.state.protect.tam.watchdog || self.p.uninstall_ok_until_ms > self.last_trusted
    }

    pub fn orders(&self) -> &Orders {
        &self.orders
    }
}

pub fn is_private_window(w: &Win) -> bool {
    BROWSERS.contains(&lower(&w.exe).as_str()) && is_private_title(&w.title)
}
