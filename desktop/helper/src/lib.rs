// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! EyeTime helper: the part that carries blocks out. `supervisor` is the logic, `os` the way to the computer,
//! `os_windows`, `server` and `agent` the Windows side.

pub mod limits;
pub mod os;
pub mod sim;
pub mod supervisor;
pub mod telemetry_send;
pub mod update;

#[cfg(windows)]
pub mod agent;
#[cfg(windows)]
pub mod os_windows;
#[cfg(windows)]
pub mod server;

#[cfg(test)]
mod tests;
