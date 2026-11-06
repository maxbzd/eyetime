# The size of the repository, and what can be done about it

`node scripts-dev/repo-size.mjs` reads the history and says where the weight is (it changes nothing). In November 2026: about 168 MB of files across all versions, a 111 MB clone, of which
roughly **41 MB the models and their engine**, **36 MB pictures for the visual tests** (154 versions of them), **26 MB the store's screenshots and demo film**, 8 MB photographs.

Nothing here is a bug; it is the price of keeping binaries in git. There are two ways to stop paying it, and they are a **decision for the owner** because each one changes how people get the
repository.

## Option A: Git LFS (the files stay in the repository, the history gets light)

```bash
git lfs install
git lfs migrate import --everything --include="scripts-dev/e2e/visual-baseline/*.png,store/**,src/newtab/ml/*.onnx,src/newtab/ml/*.wasm"
git push --force-with-lease --all        # rewrites every branch and tag: everyone clones again afterwards
```

CI jobs that need the files use `actions/checkout` with `lfs: true` (the visual suite, the build). **Cost:** someone who does `git clone` and *Load unpacked* (the README's way to install) gets small
pointer files instead of the models until `git lfs pull`: 3D photo and cut-out then do not work for them. LFS storage and bandwidth have a free quota on GitHub and are paid beyond it.

## Option B: take the binaries out of git (history and tree)

```bash
pip install git-filter-repo
git clone --mirror git@github.com:maxbzd/eyetime.git && cd eyetime.git
git filter-repo --invert-paths --path scripts-dev/e2e/visual-baseline --path store/screenshots --path store/promo --path store/demo.gif --path store/demo.mp4
git push --force --mirror
```

The visual baseline then comes from a release asset (the nightly job could publish it) or is made on demand in the CI container (`scripts-dev/e2e/visual-docker.sh --update`); the store pictures
are kept in the store's own dashboard. The models would come from the on-device-model download that is **not built yet** (it needs the decision about the extension's first network request;
see the answer to "models outside the package"). **Cost:** the visual tests lose their reference until it is stored elsewhere.

## Whichever you choose

- Do it on a day with no open pull requests: it rewrites commit ids, so every open branch has to be rebased onto the new history.
- Keep the mirror clone you made as the backup until you are sure.
- Add the same paths to the checks that stop big files from coming back (a size limit in `scripts-dev/check.mjs` is a few lines; say if you want it).
