# Not doing

Deliberate decisions to leave something as it is, with the reasoning, so they are not re-raised as defects. Delete an entry if the reasoning stops holding, or move it back to [todo.md](todo.md) when it is prioritized.

## Admin user JSON export includes the password digest

**Location:** `app/views/admin/users/index.json.jbuilder`, `app/controllers/admin/users_controller.rb` (`password_encrypted`)

`GET /admin/users.json` returns each user's stored bcrypt digest (`:password`) unless `@shallow` is set. This is intentional: commit `88961911` ("Support api based migration of data between Quepid's", 2023-09-20) added it, together with the `password_encrypted` parameter on admin create/update, so an administrator can move accounts between Quepid instances without forcing everyone to reset their password.

**Why we aren't changing it:**
- Only administrators can reach it, and an administrator can already set any user's password.
- The value is a bcrypt digest, not plaintext.
- Removing it breaks instance-to-instance account migration, and the JSON export is the only path that provides the digest.

**Residual risk:** a digest can be attacked offline if an admin session, response log or export file leaks. Treat exports as sensitive.

**Revisit if:** migration is no longer supported (then remove `:password` from the JSON and the `password_encrypted` handling together), or if a stricter option is wanted, such as an explicit opt-in parameter for including the digest.

The HTML user page does not display the digest. Migration only needs the JSON export, so that display was removed.

## [PREEXISTING] Wizard TLS reload exposes basic-auth credentials

The `http`↔`https` switch is a cross-origin navigation, so browser storage and `Secure` session cookies cannot provide a direct handoff. A short-lived, single-use opaque token could retrieve server-side pending state without sharing those cookies, keeping the credential itself out of browser history and URL logs. Redemption over plaintext `http` would still carry transport risk. This mitigation is deferred, not technically impossible.

## [PREEXISTING] Wizard TLS reload loses endpoint-specific settings

The same server-side handoff could preserve the full pending endpoint configuration (headers, mapper code, field selections), including explicit empty values, without reapplying engine defaults over it. This work is deferred; currently users re-enter those settings after the switch.

## [PREEXISTING] Stored search-endpoint credentials are serialized to members

**Why deferred:** Plain `http` search engines must remain supported, and direct browser searches against them need the stored `api_basic_auth_credential` and custom headers in the client. Withholding secrets means mandatory server-side proxying, which a direct browser search cannot use; an HTTPS-hosted Quepid also cannot call `http` engines from the browser (mixed content). Needs a decision on the credential-sharing contract before any change.

**Location:** `app/models/concerns/maskable_credential.rb:21-28`, `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder:11-15`, `app/views/api/v1/tries/_try.json.jbuilder:22-25`

`api_basic_auth_credential` is returned in full unless `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is enabled (default false), so shared endpoint members receive stored credentials in endpoint and try responses.

**Fix direction if revisited:** Never serialize credentials or custom secret headers; return a presence-only value and proxy server-side. Make this unconditional rather than flag-dependent.
