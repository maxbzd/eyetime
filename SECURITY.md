# Security policy

EyeTime is a browser extension and a Windows program that closes sites and programs, runs a service with system rights and updates itself. A flaw in it can matter,
so this page says how to report one, what is in scope, what we defend against (and what we do not), and how the signing key is handled.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting: *Security → Report a vulnerability* in this repository
(<https://github.com/maxbzd/eyetime/security/advisories/new>), or write privately to <maxbzd1600@gmail.com> or Telegram [@maxbzd](https://t.me/maxbzd) (a direct message, not a group). Say what you found, how to repeat it, and what you think it allows.

What to expect: an answer within **7 days**, a fix or a clear plan within **30 days** for anything that lets a program or a web page do something the person did not
allow, and credit in the release notes if you want it. Please give us the time to ship a fix before you publish.

## What is in scope

| Part | Examples of what counts |
|---|---|
| **The Windows service** (`desktop/helper`) | a program without administrator rights making the service loosen a block, end a session, read or change the PIN, close a program it should not, or write to the hosts file anything but the managed block |
| **The named pipe** | getting a role it should not have; making the service stop answering (a flood, a half-sent line) |
| **The update** (`desktop/core/src/update.rs`) | getting an installer run that the release key did not sign; replaying an older signed release; downgrading |
| **The installer** | running a program from the folder it was started in with administrator rights; leaving a folder or a key writable by everyone |
| **The window** (`desktop/prototype`, Tauri) | any way for text that is not ours (a program name, a site, a rule name) to run as script or to call the service |
| **The extension** | a web page reaching its storage or its messages; leaking what it stores; code from outside running in an extension page; the dock or the social-site guard doing more than documented |
| **The usage collector** (`server/usage`) | storing or exposing anything beyond the documented fields; being filled with made-up installs |

## What is not a vulnerability

- A person with administrator rights, or physical access, who is determined to get round EyeTime on their own computer. The locks are there to stop an impulse at 2 a.m.,
  not an attacker with the machine (`desktop/README.md` says this in plain words). Booting to recovery, stopping the service from outside, uninstalling after the
  permission is given, editing the browser's profile by hand: not in scope.
- The hosts file cannot see a site reached by a number, or through a browser's own encrypted DNS: this is a limit of the method and is listed in the README.
- A browser extension can be disabled by the person in the browser. Strict mode of the extension is a commitment, not a lock; the lock is the desktop program.
- Reports that need the person to install something hostile themselves.
- Ways round the browser extension's blocking that come from how a browser works, listed here so that nobody has to guess what is promised:
  a site opened by its number (`http://142.250.74.14/`) or through a mirror, a proxy or a translator that is not in the lists; a blocked site in a frame of an allowed page
  (stopped only while *Instant blocking* is on, because the browser lets the extension see a frame only with the optional "all sites" permission); the 10 seconds that
  "Continue" leaves open for the redirect chain in that one tab; the short-video guard on a page (the page owns its own DOM and can remove the guard).
  These are friction for a moment of weakness, not a wall; the lock is the desktop program.
- A passphrase that is short or common. The length of a new passphrase is checked (12 characters, and not the passwords everyone tries first), but whoever has a copy of the
  browser profile can try guesses offline at the speed of their own machine: PBKDF2 (the only function Web Crypto has; Argon2id is not available to an extension) makes each guess
  cost 600 000 rounds, and no limit in the interface can slow a program that never uses the interface. The advice on the screen is the real defence: longer, four random words.
- The key of an unlocked vault sits in `chrome.storage.session` (memory only, gone when the browser closes, not readable by web pages or content scripts) so that it survives the
  worker being stopped; script running on one of the extension's own pages could read it, which is why such script must not exist (the policy and the tests are for that).
- `'wasm-unsafe-eval'` in the extension's policy: needed to compile the WebAssembly of the on-device photo models, and nothing else; there is no `eval` and no `new Function`.

## What we defend against

1. **A web page** (or anything a page can make a browser send) must not be able to read or change EyeTime's data or messages, or make an extension page run its script.
   The extension has no `innerHTML` with data, a CSP of `script-src 'self'`, no site access by default, and checks who sent every message.
2. **Another program run by the same person** must not be able to turn the service against them. The pipe tells who is on the other end from the system (the real file of the
   connecting program and whether it is elevated), never from the request; unknown programs get a few connections and a few seconds; programs to close are taken from the
   system's own process table and checked again before they are ended.
3. **A stolen release account** must not be able to put a program on everyone's computer. An update runs only if the Ed25519 release key signed *this version of this file*
   (`desktop/core/src/update.rs`); the key is in a repository secret that only the release job reads.
4. **Our own mistakes in what we show.** The window escapes every name that came from a person or from the computer before it reaches markup, and its policy forbids inline script;
   `desktop/tests/xss_real.cjs` tries hostile names against it.

## Secrets kept by the extension

Tokens and passwords of the connected services (Todoist, Notion, CalDAV) are kept in `chrome.storage.local`, which the browser stores unencrypted in the profile folder. They are never
synced, never in a backup and never in the usage report; *Disconnect* deletes them.

**Optional passphrase** (Settings → Data & privacy → Connected services). With it, each connection's details are one AES-256-GCM message, bound to the id of the connection, under a key
made from the passphrase with PBKDF2-SHA256 (600 000 rounds, random salt) (`src/shared/vault.js`, `scripts-dev/tests/vault.test.mjs`). After the passphrase is given, the key is kept in
`chrome.storage.session` (memory only, gone when the browser closes), so the connections can keep syncing in the background; after a browser start they wait, without an error, until the
passphrase is given. A forgotten passphrase cannot be recovered: the sealed details are deleted and each service asks to sign in again (tasks, history and settings are untouched).

**Optional passphrase for the synced settings and tasks** (Settings → Data & privacy → Sync → *Encrypt synced data with a passphrase*). Without it the two payloads are plain JSON in the
browser account's cloud (`chrome.storage.sync`), readable by whoever runs that cloud. With it they are compressed and sealed on the device with AES-256-GCM under a key from the passphrase (the same
PBKDF2-SHA256 as above, its own salt) before they are chunked (`src/shared/syncseal.js`, `syncvault.js`, `scripts-dev/tests/syncseal.test.mjs`, `worker-syncenc.test.mjs`, `e2e/syncenc.cjs`):
- the cloud holds ciphertext, the salt and rounds, a check value, the time of the copy and the time the passphrase was set; the key is kept in `chrome.storage.session` only, so after a browser start the sync waits for the passphrase and uploads nothing in the clear;
- the seal is bound to the payload kind and the copy's time, so a copy changed by one bit, moved from tasks to settings, or an old copy put back with a new time does not open: the run stops with "does not open" and overwrites nothing;
- a sealed copy is version 2: an older EyeTime says "written by a newer version" and leaves it alone instead of replacing the ciphertext with plain text;
- the first device to see either payload sealed asks for the passphrase before it uploads the other; a passphrase set later wins over an older one; switching it off writes plain copies that say which encryption they replace, so the other devices follow instead of sealing them again;
- a forgotten passphrase cannot be recovered: the synced copy is lost, the data on each device stays, and switching encryption off on a device overwrites the cloud with that device's data.
What it does not protect: the *existence* and rough size of the synced data and when it changed, the cloud being deleted or rolled back to an older sealed copy that still carries its own (older) time, and code running inside the browser while it is unlocked.

What it protects against: what can be read from the profile folder alone (a copy of the browser's files, a disk backup, malware that reads files but does not run inside the browser).
What it does not: code that runs inside the browser as the person while it is unlocked, and a weak passphrase (the key derivation makes each guess cost a fraction of a second, no more;
only length is required, eight characters, and a long one is better). Without a passphrase nothing is hidden: use an access token with the least rights the service offers (and an
app-specific password for CalDAV, never the account password), or set one.

## Changing the update signing key

The apps trust the public keys listed in `UPDATE_PUBKEYS_HEX` (`desktop/core/src/update.rs`); the release job signs with the first one. A list, so that a key can be replaced without
leaving anybody on a version that cannot update:

1. Make a new key: `cargo run -p eyetime-core --bin eyetime-sign -- --gen`. Keep the private half in a new repository secret; it is not used by anything yet.
2. Release a version whose list holds the **old and the new** public key (signed with the old key). Wait until people have it (the app checks about every six hours).
3. Put the new private key in `UPDATE_SIGNING_KEY` and move the new public key to the front of the list; release signed with it.
4. In a later release drop the old public key.

**If the key was stolen**, be clear about what that means: every installed app trusts it until it takes a release that no longer lists it, and whoever holds the key can sign a
malicious "update" that the apps which have not yet updated would run. So: do steps 1–3 at once in a single release that lists only the *new* key, signed with the old key
(the only way an old app will take it); say publicly that the key was stolen and ask people to check the version in *Settings → About* and, if they are on an older one, to
install the new release by hand. An app that has taken that release ignores everything signed with the stolen key from then on.

## Dependencies and the build

- Versions of the tools are fixed (`package-lock.json`, `desktop/Cargo.lock`, `desktop/rust-toolchain.toml`); CI installs from the lock and fails if it does not match.
- `npm audit` and `cargo deny` (advisories, licences, sources) run on every change; Dependabot proposes updates; CodeQL scans JavaScript, Python and Rust.
- The extension has **no runtime dependencies**: everything in it is code in this repository, plus the ONNX Runtime and two models whose licences are in `src/newtab/ml/`.

## The Windows service's rights

The helper service runs as the system, because it has to write the hosts file, close programs of any user and start the agent in the signed-in person's session. Its token is trimmed (`sc privs`) to `SeTcb`, `SeAssignPrimaryToken`, `SeIncreaseQuota` (starting the agent as the person), `SeChangeNotify`, `SeCreateGlobal` and `SeImpersonate`: not `SeDebug`, `SeLoadDriver`, `SeBackup`, `SeRestore`, `SeTakeOwnership`, `SeCreateToken`, `SeSecurity` or the rest. `SeTcb` is the one that is still strong (it is what `WTSQueryUserToken` demands); removing it would mean starting the agent another way (a per-user autostart), which is not done yet. The Windows test (`desktop/tests/smoke.ps1`) lists the privileges and runs the whole install, block, update and uninstall with the trimmed token.
