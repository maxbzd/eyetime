//! The tool that signs a release. The signature is what the installed apps check before they run an update.
//!   eyetime-sign --gen                      make a new key pair (private seed and public key, both as hex)
//!   eyetime-sign <version> <installer.exe>  print the signature (the private seed is read from the environment: UPDATE_SIGNING_KEY)

use eyetime_core::update::{sha256_file, sign_update};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(|a| a.as_str()) == Some("--gen") {
        let mut seed = [0u8; 32];
        match std::fs::File::open("/dev/urandom")
            .and_then(|mut f| std::io::Read::read_exact(&mut f, &mut seed))
        {
            Ok(()) => {}
            Err(e) => {
                eprintln!("no source of randomness here ({e}); make the key on Linux or macOS");
                std::process::exit(2);
            }
        }
        let key = ed25519_dalek::SigningKey::from_bytes(&seed);
        println!(
            "private (keep secret, give it to the release job as UPDATE_SIGNING_KEY): {}",
            seed.iter().map(|b| format!("{b:02x}")).collect::<String>()
        );
        println!(
            "public  (goes into core/src/update.rs as UPDATE_PUBKEY_HEX):             {}",
            key.verifying_key()
                .to_bytes()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        );
        return;
    }
    let (Some(version), Some(path)) = (args.first(), args.get(1)) else {
        eprintln!(
            "usage: eyetime-sign <version> <installer.exe>   (UPDATE_SIGNING_KEY in the environment)"
        );
        std::process::exit(2);
    };
    let seed_hex = std::env::var("UPDATE_SIGNING_KEY").unwrap_or_default();
    let Some(seed) = eyetime_core::update::from_hex32(seed_hex.trim()) else {
        eprintln!("UPDATE_SIGNING_KEY is missing or is not 64 hex characters");
        std::process::exit(2);
    };
    let sha = match sha256_file(std::path::Path::new(path)) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("{path}: {e}");
            std::process::exit(2);
        }
    };
    println!("{}", sign_update(&seed, version, &sha));
}
