# App-store catalogs

Typed reference inventories of apps Fleet can install from external catalogs:
**FMA** (Fleet-Maintained Apps), **VPP** (Apple Volume Purchase Program), and
**Managed Google Play** for Android.

These are *catalogs of available apps*, not GitOps payloads. Entries are bare
identifiers — tests pick what they need and add per-flow flags
(`self_service`, `setup_experience`, ...) when constructing the request.

## Files

| File | Exports | Purpose |
|---|---|---|
| [`types.ts`](./types.ts) | `Platform`, `ApplePlatform`, `FmaPlatform`, `FmaApp`, `VppApp`, `AndroidApp` | Shared types. |
| [`fma.ts`](./fma.ts) | `fmaApps: FmaApp[]` | FMA slugs (`darwin` + `windows`). |
| [`vpp.ts`](./vpp.ts) | `vppApps: VppApp[]`, `vppUiSearchNames: string[]` | VPP `(name, appStoreId, platform)` entries for API/GitOps + names for UI search. |
| [`android.ts`](./android.ts) | `androidApps: AndroidApp[]` | Managed Google Play package names. |
| [`index.ts`](./index.ts) | barrel | Convenience re-export. |

## Picking entries

```ts
import { vppApps, vppUiSearchNames, fmaApps, androidApps } from '../../helpers/catalogs';

// First iPad app
vppApps.find((a) => a.platform === 'ipados');

// All macOS FMA apps
fmaApps.filter((a) => a.platform === 'darwin');

// A name we expect to find via App Store search
vppUiSearchNames[0];
```

## Updating

- **FMA**: regenerate `fmaApps` from Fleet's upstream
  `ee/maintained-apps/inputs/` set when that catalog changes.
- **VPP / Android**: add entries as new tests need them. Keep entries
  flat — never add flow-specific flags.
