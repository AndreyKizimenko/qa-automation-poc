# SSO lab logins

Owner-only (chmod 600). Never commit or copy elsewhere.

<!-- Example only: fake values. Copy to $SSOLAB_DATA/LOGINS.md (chmod 600) and replace, or let ssolab write it
     (`ssolab creds add`, `okta connect`, `auth0 connect`, `entra connect`, `saml up`, `authentik up`).
     ssolab reads the table rows only; keep the header row and column order. A literal | in a cell is written \|.
     Rows ssolab looks up by label:
       okta/api-token          password = Okta SSWS API token
       auth0/m2m-client        username = M2M client ID, password = client secret
       entra/app-registration  username = application (client) ID, password = client secret
       authentik/api-token     password = bootstrap API token (written by `ssolab authentik up`)
     A row with an email is an IdP test user (a person who signs into Fleet with SSO); without one it's a
     tenant/console login. The 1password column is `pending`, or `synced <date>` once pushed to SSOLAB_OP_VAULT. -->

| provider | label | username | password | url | notes | 1password | email |
|---|---|---|---|---|---|---|---|
| okta | admin | you@example.com | <okta-admin-password> | https://<org>-admin.okta.com/admin/apps/active | tenant admin | pending |  |
| okta | api-token | ssolab | <okta-api-token> | https://<org>.okta.com/api/v1/ | Okta SSWS API token used by `ssolab okta provision` / `okta user` | pending |  |
| okta | qa.observer@example.com | qa.observer@example.com | <password> | https://<org>.okta.com | test user, password only | pending | qa.observer@example.com |
| auth0 | m2m-client | <m2m-client-id> | <m2m-client-secret> | https://<tenant>.<region>.auth0.com | Management API client (read/create clients, connections, users) | pending |  |
| auth0 | qa.admin@example.com | qa.admin@example.com | <password> | https://<tenant>.<region>.auth0.com | test user | pending | qa.admin@example.com |
| entra | app-registration | <application-client-id> | <client-secret> | https://entra.microsoft.com | Graph app registration used by `ssolab entra` | pending |  |
| entra | qa.maintainer | qa.maintainer@<tenant>.onmicrosoft.com | <password> | https://myapps.microsoft.com | test user | pending | qa.maintainer@<tenant>.onmicrosoft.com |
| google | admin | admin@<your-workspace-domain> | <password> | https://admin.google.com | tenant admin | pending |  |
| saml | sso_user | sso_user | user123# | http://localhost:18180/simplesaml/ | fixture, signs in as sso_user@example.com | pending | sso_user@example.com |
