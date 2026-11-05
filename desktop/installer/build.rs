//! Packs the program files into the installer. `EYETIME_PAYLOAD` names the folder that holds them
//! (eyetime.exe, eyetime-helper.exe, and WebView2Loader.dll when the build is not MSVC); without it the installer still builds, but has nothing to install.
use std::io::Write;

fn main() {
    println!("cargo:rerun-if-env-changed=EYETIME_PAYLOAD");
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("payload.rs");
    let mut f = std::fs::File::create(out).unwrap();
    writeln!(f, "pub const FILES: &[(&str, &[u8])] = &[").unwrap();
    if let Ok(dir) = std::env::var("EYETIME_PAYLOAD") {
        for name in ["eyetime.exe", "eyetime-helper.exe", "WebView2Loader.dll"] {
            let p = std::path::Path::new(&dir).join(name);
            if p.exists() {
                println!("cargo:rerun-if-changed={}", p.display());
                writeln!(f, "    ({:?}, include_bytes!({:?})),", name, p.canonicalize().unwrap().to_string_lossy().replace('\\', "/")).unwrap();
            }
        }
    }
    writeln!(f, "];").unwrap();
    // the browser extension (a folder of small files), written next to the program
    writeln!(f, "pub const EXTENSION: &[(&str, &[u8])] = &[").unwrap();
    let ext = std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("../extension");
    println!("cargo:rerun-if-changed={}", ext.display());
    if let Ok(rd) = std::fs::read_dir(&ext) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if e.path().is_file() && !name.ends_with(".test.js") && !name.ends_with(".md") {
                writeln!(f, "    ({:?}, include_bytes!({:?})),", name, e.path().canonicalize().unwrap().to_string_lossy().replace('\\', "/")).unwrap();
            }
        }
    }
    writeln!(f, "];").unwrap();
}
