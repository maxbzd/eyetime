# Building and verifying the packages

You do not need to build anything to **use or develop** EyeTime: load the repository folder as it is (`chrome://extensions` → Developer mode → Load unpacked). The packages on the
release page are a *production build* of the same source: smaller and faster to open, made by one command.

```bash
npm ci                    # the tools, at the versions in package-lock.json (esbuild, eslint, typescript)
npm run build             # checks, then writes dist/eyetime-chrome.zip and dist/eyetime-firefox.zip
EYETIME_BUILD=source node scripts-dev/pack.mjs     # the same zips with the source tree inside, not the bundles (to read, or to chase a bug only the bundle shows)
```

## What the build does (`scripts-dev/build.mjs`)

- Each page's script becomes **one bundle** (the new tab loads 2 scripts instead of 131), minified; style sheets are minified one for one. Names of exports and every string are kept: it is
  smaller, not obfuscated.
- Files that are loaded **by their path** at run time stay where they are: the workers and the engine of the on-device models (`src/newtab/ml/`), the content scripts, the pages, the language
  files (`src/shared/locales/data/*.json`), photographs, sounds.
- A module that went into a bundle is not shipped a second time. Nothing may use `import.meta.url` (it names the bundle in the build); `npm run check` fails if something does.
- The zip is written by `scripts-dev/zip.mjs`: entries in byte order, a fixed time stamp, a fixed compression level. **The same source gives the same bytes.**

## Check that a release is what the source says

```bash
git checkout v3.9.1 && npm ci
node scripts-dev/verify-build.mjs --against ~/Downloads/eyetime-chrome.zip
```

It builds twice (the two must be identical), then compares your build with the file you downloaded, by SHA-256. Each release also carries a signed **provenance** statement (Sigstore, through
GitHub): `gh attestation verify eyetime-chrome.zip --repo maxbzd/eyetime` says which commit and which workflow made that file. `eyetime-sbom.cdx.json` (CycloneDX) lists what the package holds:
the extension has no runtime dependencies, so the list is the third-party *files* (the model engine, two models, icons, fonts, sounds, photographs) with their licences.

## For a store review (Firefox AMO asks for the source of a bundled add-on)

Give the reviewer the repository at the release tag and the three commands above (`npm ci`, `npm run build`, then compare `dist/eyetime-firefox.zip`). Node 22 or newer. No network is needed
after `npm ci`, and nothing is downloaded by the build.

## Testing the package itself

`EXT=$PWD/dist/chrome node scripts-dev/e2e/dist.cjs` loads the built package into Chromium and uses it (every page, a language read as data, a session, the pause page, counting, the content
script). It exists because the other end-to-end suites reach into the source tree, which a bundle does not have; CI runs it as the `package` job.
