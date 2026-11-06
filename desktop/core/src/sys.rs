//! Where the programs that ship with Windows live.
//!
//! Asking for `sc` or `reg` by bare name makes Windows look in the folder the program was started from first. For the installer that
//! folder is where the person downloaded it (Downloads: writable by anyone who can run code as them) and it runs as an administrator, so
//! a planted `sc.exe` next to it would run with full rights. Every tool is therefore started by its full path.

use std::path::PathBuf;

fn windir() -> PathBuf {
    std::env::var_os("SystemRoot")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
}

/// `sc` -> `C:\Windows\System32\sc.exe`. A name that already has a folder in it (or a drive) is returned as it is.
pub fn system32(name: &str) -> PathBuf {
    if name.contains(['\\', '/', ':']) {
        return PathBuf::from(name);
    }
    // the one tool that does not live directly in System32
    if name.eq_ignore_ascii_case("powershell") || name.eq_ignore_ascii_case("powershell.exe") {
        return powershell();
    }
    let file = if name.contains('.') {
        name.to_string()
    } else {
        format!("{name}.exe")
    };
    windir().join("System32").join(file)
}

/// `explorer` -> `C:\Windows\explorer.exe` (the programs that live in the Windows folder itself)
pub fn windows_dir(name: &str) -> PathBuf {
    let file = if name.contains('.') {
        name.to_string()
    } else {
        format!("{name}.exe")
    };
    windir().join(file)
}

/// Windows PowerShell 5, which is on every Windows 10 and 11
pub fn powershell() -> PathBuf {
    windir().join(r"System32\WindowsPowerShell\v1.0\powershell.exe")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bare_name_becomes_a_full_path_in_the_system_folder() {
        let p = system32("sc").to_string_lossy().to_lowercase();
        assert!(
            p.ends_with("system32/sc.exe") || p.ends_with(r"system32\sc.exe"),
            "{p}"
        );
        let p = system32("curl.exe").to_string_lossy().to_lowercase();
        assert!(
            p.ends_with("curl.exe") && !p.ends_with("curl.exe.exe"),
            "{p}"
        );
    }

    #[test]
    fn powershell_by_its_bare_name_is_found_where_it_really_is() {
        // run("powershell", ...) in the installer asked for System32\\powershell.exe, which does not exist: no shortcut, so no install
        for name in ["powershell", "PowerShell", "powershell.exe"] {
            let p = system32(name).to_string_lossy().to_lowercase();
            assert!(
                p.contains("windowspowershell") && p.ends_with("powershell.exe"),
                "{name}: {p}"
            );
        }
    }

    #[test]
    fn a_name_with_a_folder_is_left_alone() {
        assert_eq!(
            system32(r"C:\tools\x.exe"),
            PathBuf::from(r"C:\tools\x.exe")
        );
        assert_eq!(system32("/usr/bin/x"), PathBuf::from("/usr/bin/x"));
    }

    #[test]
    fn the_windows_folder_tools_are_not_looked_for_in_system32() {
        let p = windows_dir("explorer").to_string_lossy().to_lowercase();
        assert!(
            p.ends_with("explorer.exe") && !p.contains("system32"),
            "{p}"
        );
    }

    #[test]
    fn powershell_is_where_windows_puts_it() {
        let p = powershell().to_string_lossy().to_lowercase();
        assert!(
            p.contains("windowspowershell") && p.ends_with("powershell.exe"),
            "{p}"
        );
    }
}
