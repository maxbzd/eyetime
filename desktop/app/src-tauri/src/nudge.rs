// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
//! Quiet reminders from the window's own process (which lives in the tray when the window is closed):
//! an eye break every N minutes of real work at the screen, and a soft note before bedtime. A Windows notification, nothing more.

use super::read_settings;
use std::time::Duration;

#[cfg(windows)]
fn idle_secs() -> u64 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    unsafe {
        let mut li = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut li) == 0 {
            return 0;
        }
        (GetTickCount().wrapping_sub(li.dwTime) / 1000) as u64
    }
}
#[cfg(not(windows))]
fn idle_secs() -> u64 {
    0
}

/// (minutes since midnight, a number that changes every day) in the person's own time
#[cfg(windows)]
fn local_now() -> (u32, u32) {
    use windows_sys::Win32::Foundation::SYSTEMTIME;
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;
    unsafe {
        let mut t: SYSTEMTIME = std::mem::zeroed();
        GetLocalTime(&mut t);
        (
            t.wHour as u32 * 60 + t.wMinute as u32,
            t.wYear as u32 * 400 + t.wMonth as u32 * 31 + t.wDay as u32,
        )
    }
}
#[cfg(not(windows))]
fn local_now() -> (u32, u32) {
    (0, 0)
}

fn xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// A Windows toast under the name "EyeTime" (the name is registered for the current user: no installer rights needed).
#[cfg(windows)]
pub fn toast(title: &str, body: &str) {
    use std::os::windows::process::CommandExt;
    let script = format!(
        "$k='HKCU:\\Software\\Classes\\AppUserModelId\\EyeTime'; if (-not (Test-Path $k)) {{ New-Item -Path $k -Force | Out-Null; New-ItemProperty -Path $k -Name DisplayName -Value 'EyeTime' -PropertyType String -Force | Out-Null }}; \
         [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
         $x = New-Object Windows.Data.Xml.Dom.XmlDocument; \
         $x.LoadXml('<toast><visual><binding template=\"ToastText02\"><text id=\"1\">{}</text><text id=\"2\">{}</text></binding></visual></toast>'); \
         [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('EyeTime').Show([Windows.UI.Notifications.ToastNotification]::new($x))",
        xml(title).replace('\'', "''"),
        xml(body).replace('\'', "''")
    );
    let _ = std::process::Command::new(eyetime_core::sys::powershell())
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .creation_flags(0x0800_0000)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
}
#[cfg(not(windows))]
pub fn toast(_title: &str, _body: &str) {}

pub fn start() {
    std::thread::spawn(|| {
        let mut active = 0u64;
        let mut bed_day = 0u32;
        loop {
            std::thread::sleep(Duration::from_secs(15));
            let s = read_settings();
            if !s["notify"].as_bool().unwrap_or(true) {
                active = 0;
                continue;
            }
            let ru = s["lang"].as_str() == Some("ru");
            let idle = idle_secs();
            if idle >= 120 {
                active = 0; // two minutes away from the keyboard is a break already
            } else if idle < 60 {
                active += 15;
            }
            let every = s["every"].as_u64().unwrap_or(20).clamp(5, 120) * 60;
            if active >= every {
                active = 0;
                if ru {
                    toast(
                        "Перерыв для глаз",
                        "Посмотрите вдаль на 6 метров на 20 секунд.",
                    );
                } else {
                    toast(
                        "Eye break",
                        "Look at something 20 feet away for 20 seconds.",
                    );
                }
            }
            if let Some(bed) = s["bed"].as_str() {
                let mut p = bed.split(':');
                if let (Some(h), Some(m)) = (
                    p.next().and_then(|x| x.parse::<u32>().ok()),
                    p.next().and_then(|x| x.parse::<u32>().ok()),
                ) {
                    let (now, day) = local_now();
                    // the evening note comes at the chosen time, once a day
                    if now == (h * 60 + m) % 1440 && bed_day != day {
                        bed_day = day;
                        if ru {
                            toast(
                                "Вечерний режим",
                                "Пора сбавить обороты: экран и свет мягче, скоро спать.",
                            );
                        } else {
                            toast(
                                "Wind down",
                                "Time to slow down: softer light, and sleep is near.",
                            );
                        }
                    }
                }
            }
        }
    });
}
