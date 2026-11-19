# Elvani — brand

The mark is a sphere of dots: large at the heart, finer toward the edge. Drawn once as a vector, sixty-one circles.

| File | Use |
| --- | --- |
| `mark-dark.svg`, `mark-light.svg` | the mark alone: ink on paper, paper on ink |
| `wordmark-dark.svg`, `wordmark-light.svg` | the name alone |
| `lockup-dark.svg`, `lockup-light.svg` | mark and name side by side (the usual logo) |
| `icon.svg` | the app icon: the whole mark in a rounded square, for 64 px and up |
| `icon48.svg`, `icon32.svg`, `icon16.svg` | the same icon with fewer, bigger dots, so that it still reads at toolbar sizes |
| `source/` | the masters as supplied (PNG, 2048 px mark, 2403 px logo) |

**Colours.** Ink `#0A0A09`, paper `#F5F3F0`. Nothing else is part of the mark.

**Clear space.** Around the mark keep at least the height of the largest dot (about a tenth of the mark's height). **Smallest size.** The lockup: 96 px wide. The mark alone: 24 px; below that use the icon files.

**Do not** put the mark on a busy photo without a plain panel behind it, recolour it, outline it, rotate it, or redraw the dots: use the files.

The icons (`icons/`, `desktop/…/icons/`, the `.ico`) are made from these files: `node scripts-dev/build-brand.cjs`.

The name and the mark are not licensed with the code (see `NOTICE`).
