# Image fixtures

Cross-platform PNGs the suite uploads: software **custom icons**
(`premium/software/custom-icons.spec.ts`) and the **organization logo**
(`shared/settings/organization/custom-logo.spec.ts`).

They are generated rather than downloaded, because what each one is *for* is a
number — a byte count or a pixel dimension that sits on one side of a Fleet
validation boundary. A generated file states that number; a screenshot of a real
logo only happens to have it.

| file | dimensions | size | what it's for |
|---|---|---|---|
| `fleet-test-icon-valid.png` | 256×256 | 567 B | inside every limit — the happy path |
| `fleet-test-icon-oversize.png` | 256×256 | ~192 KB | over the 100 KB cap ("Icon must be 100KB or less.") |
| `fleet-test-icon-not-square.png` | 200×256 | 525 B | not square (dimension error) |
| `fleet-test-icon-too-large.png` | 1025×1025 | 4.5 KB | one pixel past the 1024 maximum |
| `fleet-test-icon-too-small.png` | 100×100 | 203 B | under the 120 minimum |
| `fleet-test-logo.png` | 256×256 | 567 B | a second valid image, distinct in colour — the "replace it with a different one" half of the icon lifecycle, and the org logo |

The limits come from `EditIconModal` in Fleet's frontend (`MAX_FILE_SIZE`,
`MIN_DIMENSION`, `MAX_DIMENSION`) and from `utilities/file/orgLogoFile.ts` for
the logo, which shares the 100 KB cap.

The oversized file is filled from a linear congruential generator rather than a
solid colour: PNG deflates a flat image down to a few hundred bytes, so only
incompressible pixel data pushes the file past 100 KB while keeping it a valid
square image.

## Regenerating

`make-icons.py` writes all six with the standard library alone — no Pillow, no
network. It is deterministic: the same inputs produce byte-identical files.

```sh
python3 test-data/shared/images/make-icons.py test-data/shared/images
```

Edit the `FILES` table in that script to change a dimension or add a case; keep
the table in this README in step with it.
