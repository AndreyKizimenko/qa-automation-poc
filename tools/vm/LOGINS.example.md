# VM logins

Guest OS logins, one row per VM in inventory.tsv. Lives at $VM_DATA/LOGINS.md (chmod 600, never committed).
`vm golden` adds the golden's row; `vm clone` copies it for the clone; `vm rename`/`vm rm` keep it in sync.
The first column must be the VM name. Extra notes (e.g. Windows security-question answers) can go below the table.

| vm | user | password | notes |
|---|---|---|---|
| ubu24-arm-base | qa | example-password | golden |
| ubu24-arm | qa | example-password | clone of ubu24-arm-base |
