// The three manifest files that winget-pkgs wants for EyeTime for Windows, made from the numbers of a release.
//   node desktop/packaging/winget/make.mjs <version> <sha256-of-EyeTime-Setup.exe> <outdir> [owner/repo]
// The release workflow runs it, validates the result with `winget validate`, and attaches it to the release; submitting it to https://github.com/microsoft/winget-pkgs
// (a pull request from the owner's account, `wingetcreate submit` does it) is what makes `winget install maxbzd.EyeTime` work. The installer is EyeTime's own (`--silent` installs without a window).
import fs from 'node:fs';
import path from 'node:path';

const [version, sha, outdir, repo = 'maxbzd/eyetime'] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '') || !/^[0-9a-fA-F]{64}$/.test(sha || '') || !outdir) { console.error('usage: make.mjs <x.y.z> <sha256 hex> <outdir> [owner/repo]'); process.exit(2); }
const ID = 'maxbzd.EyeTime', SCHEMA = '1.9.0';
const header = (type) => `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${SCHEMA}.schema.json\n`;
const files = {
  [`${ID}.yaml`]: header('version') + `PackageIdentifier: ${ID}\nPackageVersion: ${version}\nDefaultLocale: en-US\nManifestType: version\nManifestVersion: ${SCHEMA}\n`,
  [`${ID}.locale.en-US.yaml`]: header('defaultLocale') + `PackageIdentifier: ${ID}
PackageVersion: ${version}
PackageLocale: en-US
Publisher: EyeTime contributors
PublisherUrl: https://github.com/${repo}
PublisherSupportUrl: https://github.com/${repo}/issues
PrivacyUrl: https://maxbzd.github.io/eyetime/privacy.html
Author: EyeTime contributors
PackageName: EyeTime
PackageUrl: https://github.com/${repo}
License: FSL-1.1-ALv2
LicenseUrl: https://github.com/${repo}/blob/main/LICENSE
ShortDescription: Closes distracting sites and programs on a schedule, in sessions and by limits; local, no account.
Description: A Windows program that really closes things. A protected service blocks sites (the hosts file) and programs on a schedule, in focus sessions and by limits; the window is only a view. Free, open source, no account, nothing leaves the computer.
Moniker: eyetime
Tags:
- focus
- productivity
- website-blocker
- screen-time
- eye-care
ReleaseNotesUrl: https://github.com/${repo}/releases/tag/desktop-v${version}
ManifestType: defaultLocale
ManifestVersion: ${SCHEMA}
`,
  [`${ID}.installer.yaml`]: header('installer') + `PackageIdentifier: ${ID}
PackageVersion: ${version}
MinimumOSVersion: 10.0.17763.0
InstallerType: exe
Scope: machine
InstallModes:
- silent
InstallerSwitches:
  Silent: --silent
  SilentWithProgress: --silent
UpgradeBehavior: install
ElevationRequirement: elevatesSelf
Installers:
- Architecture: x64
  InstallerUrl: https://github.com/${repo}/releases/download/desktop-v${version}/EyeTime-Setup.exe
  InstallerSha256: ${sha.toUpperCase()}
ManifestType: installer
ManifestVersion: ${SCHEMA}
`,
};
const dir = path.resolve(outdir, 'manifests', 'm', 'maxbzd', 'EyeTime', version);
fs.mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
console.log(`✓ ${Object.keys(files).length} manifests in ${dir}`);
