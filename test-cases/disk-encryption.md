# Disk Encryption — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## BitLocker disk encryption (Windows)

### DISK-001 — Enforce BitLocker disk encryption and escrow the recovery key on Windows hosts

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Windows
- **Preconditions:** Premium license; Windows MDM turned on; at least one Windows host enrolled to a team; admin signed in.
- **Source:** #12577

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Controls > OS settings > Disk encryption and verify the copy and "Learn more" link. | Disk encryption copy references FileVault (FV2) and BitLocker; the "Learn more" link points to the correct docs. |
| 2 | Enable disk encryption for the team. | The setting is enabled; an activity feed entry records that the admin enforced disk encryption. |
| 3 | Review the Controls disk-encryption table and host counts. | Table is no longer sortable, splits macOS and Windows hosts into separate columns, shows correct combined counts, and host-count tooltips are correct; the "See all hosts" link opens the filtered "OS settings" host view. |
| 4 | Wait for the Windows host to encrypt, then open Host details > OS settings for that host. | Windows host shows OS settings with the same statuses available for macOS (Pending/Verifying/Verified/Failed); clicking a status opens a modal that closes via Done; tooltip copy matches design. |
| 5 | Open the encryption key modal for the Windows host. | Modal shows Windows-specific copy, links to the correct docs, and the BitLocker recovery key can be viewed/copied; closes via Done. |
| 6 | View the encryption key and check the activity feed. | An activity feed entry records that the encryption key was viewed. |
| 7 | As the end user on the Windows host, attempt to turn off BitLocker; then have the Fleet admin turn encryption off. | End user cannot disable encryption while enforced; when the admin turns encryption off in Fleet, the host's encryption status updates correctly. |

### DISK-002 — Require a BitLocker PIN for Windows disk encryption

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with Windows MDM enabled; an encrypted Windows host enrolled into a team; admin and end-user access.
- **Source:** #28133, #33726

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In OS settings > Disk encryption, turn on disk encryption and expand Advanced options. | A "Require BitLocker PIN" toggle is visible with a tooltip explaining end users must set a PIN. |
| 2 | Enable "Require BitLocker PIN" and save. | Encrypted Windows hosts without a PIN move to "Action required (pending)"; unencrypted hosts stay "Enforcing (pending)"; macOS/Linux unaffected. |
| 3 | On the Windows host's My device page, click the "Create PIN" link in the yellow disk-encryption banner. | A modal opens with step-by-step instructions to set a PIN via "Manage BitLocker". |
| 4 | Set a PIN in Windows, close the modal, and click Refetch. | The banner disappears and the host moves to "Verified" in admin OS settings. |
| 5 | Enable disk encryption + PIN, save, then uncheck only "Turn on disk encryption" leaving PIN required, and save. | An easy-to-understand error explains disk encryption must be enabled to require a BitLocker PIN. |
| 6 | Via GitOps/API, set `windows_require_bitlocker_pin` true with `enable_disk_encryption` false. | An easy-to-understand error is returned; setting both true mirrors the UI behavior. |

## Disk encryption enforcement & configuration

### DISK-003 — Enforce disk encryption cross-platform via YAML key

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Premium license; MDM turned on for the relevant platform(s); fleetctl configured with admin credentials.
- **Source:** #12577

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a YAML config using `mdm.enable_disk_encryption: true` for a team (and for "No team"). | Disk encryption is enforced for both macOS and Windows hosts on the target team/No team. |
| 2 | Apply a YAML config using the legacy `mdm.macos_settings.enable_disk_encryption: true` key. | The legacy key is still honored and enables disk encryption. |

### DISK-004 — Show error directing to Disk encryption page when a custom profile contains disk-encryption settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Premium license; MDM turned on; admin signed in; configuration profiles ready that contain FileVault (macOS) and BitLocker (Windows) disk-encryption settings, plus an unrelated valid profile and a CSP file.
- **Source:** #24862

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings > Custom settings, upload a configuration profile that includes FileVault disk-encryption settings. | Upload is rejected with an error message whose copy directs the user to the Disk encryption page. |
| 2 | Upload a configuration profile that includes BitLocker disk-encryption settings. | Upload is rejected with an error message directing the user to the Disk encryption page. |
| 3 | Upload an unrelated valid configuration profile and a CSP file. | Both upload successfully. |
| 4 | Repeat the disk-encryption profile upload via the API and via GitOps. | The API returns the same restriction error message; GitOps surfaces the same API error message. |

## FileVault disk encryption (macOS)

### DISK-005 — Rotate and escrow FileVault key over a pre-existing third-party FileVault profile

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; macOS MDM turned on; a macOS host that already has a custom FileVault configuration profile deployed by a prior MDM (e.g. MicroMDM); disk encryption enforcement enabled in Fleet.
- **Source:** #13157

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enforce disk encryption in Fleet for the team without first removing the host's old third-party FileVault profile. | Fleet installs its managed FileVault profile over the existing one without requiring removal of the old profile. |
| 2 | Watch the host's disk encryption status in Host details > OS settings as it progresses. | The IT admin sees the disk-encryption statuses transition correctly (Pending, Verifying, Verified) and the key is escrowed to Fleet. |
| 3 | On the host, log the end user out and back in. | The expected end-user experience occurs (any prompt/pop-up behavior is as documented) and FileVault remains enforced with the key escrowed. |

### DISK-006 — End user cannot bypass FileVault enforcement on a manually-enrolled Mac

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; macOS MDM turned on with disk encryption enforced for the team; a macOS host that the end user turned on MDM for manually.
- **Source:** #29250

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the manually-enrolled Mac with FileVault enforced, have the end user log out or restart. | The end user is required to turn on disk encryption to log in; they cannot bypass FileVault enforcement to get back to work. |

## LUKS disk encryption (Linux)

### DISK-007 — Re-verify Linux disk encryption after a key change

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Premium Fleet instance with a Linux host (LUKS-capable) ready to enroll into a team where disk encryption can be enforced.
- **Source:** #26693

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings, enforce disk encryption for a team and add the Linux host to that team. | Disk encryption is enforced for the team. |
| 2 | On the host's My device page, follow the prompts to escrow a key. | The disk encryption prompt disappears and the host shows as verified in Fleet. |
| 3 | On the Linux device, edit the disk encryption key. | Fleet shows the host as pending; a banner appears on both the host details page and My device. |
| 4 | On My device, follow the escrow instructions again. | The prompt disappears and the host returns to verified. |
| 5 | Use the newly escrowed key to unlock the Linux device. | The device unlocks with the new key. |

### DISK-008 — LUKS disk encryption and key escrow work on Kubuntu

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Fleet Premium instance with disk encryption enforced for a team. Fresh Kubuntu host available to enroll into that team. Disk encryption (LUKS) feature is gated to supported Linux OSes.
- **Source:** #19594, #22074, #23697

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a fresh Kubuntu host (no zenity installed) into the team with disk encryption enforced, then open the My device page and follow the escrow prompt | A kdialog-based prompt is shown; after completing it, the disk encryption key is escrowed and the host shows as verified in Fleet |
| 2 | On a Kubuntu host, install zenity (`sudo apt install zenity`), trigger escrow again, and follow the prompt | The zenity dialog is used (preferred over kdialog when both are present) and the key escrows successfully |
| 3 | Repeat enrollment and key escrow on Fedora and Ubuntu hosts | Disk encryption and key escrow still work on the previously supported OSes (no regression) |
| 4 | Enroll a Linux host running a distro not in the supported list and enforce disk encryption | The LUKS disk encryption escrow prompt does not appear on the unsupported OS |

## Recovery Lock password (macOS)

### DISK-009 — Enable Recovery Lock password in Controls and surface it in OS settings and vitals

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license, signed in as an admin or maintainer. At least one macOS host enrolled. `enable_recovery_lock_password` is initially off.
- **Source:** #37497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > OS settings as a maintainer or admin. | A "Passwords" section is present with an option for "Recovery Lock password". |
| 2 | Hover the "Recovery Lock password" tooltip. | Tooltip displays explanatory copy describing the Recovery Lock password setting. |
| 3 | Enable the Recovery Lock password option (set `enable_recovery_lock_password` to true). | Setting saves; Recovery Lock password host count is included in vitals. |
| 4 | Open a macOS Host details page and click the "OS settings" vital. | The OS settings table includes a Recovery Lock password item showing its status (verified, pending, or failed). |

### DISK-010 — View an escrowed macOS Recovery Lock password from Host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed in Fleet. Signed in as a role permitted to view recovery passwords (admin, maintainer, observer, or observer+ — any role except GitOps).
- **Source:** #37497, #37498, #41003

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page and open the Actions dropdown. | The "Show Recovery Lock password" action is present and enabled. |
| 2 | Click "Show Recovery Lock password". | The Recovery Lock password modal opens and displays the escrowed password. |
| 3 | Open the host's activity feed. | A "viewed Recovery Lock password" activity is recorded for the host. |

### DISK-011 — Hide the Recovery Lock password action when the feature is disabled

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is disabled. A macOS host enrolled.
- **Source:** #37497, #37498

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page and open the Actions dropdown. | The "Show Recovery Lock password" action is not shown in the dropdown. |

### DISK-012 — Rotate a macOS Recovery Lock password from the modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed. Signed in as an admin or maintainer.
- **Source:** #37498, #41003

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page, open the Actions dropdown, and click "Show Recovery Lock password". | The Recovery Lock password modal opens, shows the password, includes a warning note, and exposes a "Rotate password" control (admin/maintainer only). |
| 2 | Click "Rotate password". | A rotation is triggered; the host's activity feed records a manual rotation activity reading "<User> triggered a password rotation". |
| 3 | While a rotation is already pending, click "Rotate password" again in the modal. | The password is rotated right away and the scheduled automatic rotation does not also occur. |

### DISK-013 — Block rotation for non-maintainer roles while still allowing view

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed. Signed in as an observer or observer+ (a role that can view but not rotate).
- **Source:** #37498

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page, open the Actions dropdown, and click "Show Recovery Lock password". | The modal opens and the password is viewable. |
| 2 | Inspect the modal for rotation controls. | No "Rotate password" control is available to this role; viewing is permitted for all roles except GitOps. |

### DISK-014 — Automatically rotate the Recovery Lock password and log a Fleet-initiated activity

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed, with a rotation pending and no manual rotation triggered.
- **Source:** #41003

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Leave a Recovery Lock password pending rotation and wait for the automatic rotation interval (60 minutes) to elapse without any manual action. | After 60 minutes the password is automatically rotated. |
| 2 | Open the host's activity feed. | A Fleet-initiated rotation activity is recorded (no user attributed). |

### DISK-015 — Recovery Lock password feature is hidden on Fleet Free

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Fleet Free instance with a macOS host enrolled. Signed in as an admin.
- **Source:** #37497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > OS settings. | No "Passwords" section or Recovery Lock password option is present. |
| 2 | Open a macOS Host details page and open the Actions dropdown. | No "Show Recovery Lock password" action is present. |
