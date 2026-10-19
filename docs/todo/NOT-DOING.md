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

## [MIGRATION-FOLLOWUP] Remove runtime forwarding adapters

Retain the scoped adapters and named async accessors used by bootstrap, wizard, tuning and snapshots. Removing forwarding would move dependency selection and receiver binding into consumers without removing an owner, request or state copy. A generic facade would duplicate the existing capability groups.

**Revisit if:** a concrete dependency design meaningfully simplifies consumers while preserving shared instances, startup order, Promise/error/microtask timing, method receivers and tuning's `draft()` versus wizard's `editable()`. See the [runtime forwarding assessment](rails_stimulus_json_workspace_plan.md#runtime-forwarding-assessment) for contracts and verification.

## [MIGRATION-FOLLOWUP] Share initial annotation reads between the list and graph

Rails already renders the list with the case page; only the graph makes an initial annotation JSON GET. Retain the separate projections: removing the remaining GET would change startup freshness and independent failure handling, while a shared store would add mutation and invalidation coordination. The measured saving does not justify that work. Snapshot catalogs also retain a fresh read on every modal open.

**Revisit if:** representative production measurements justify the coordination and a concrete design preserves list errors, graph refresh and `annotations:changed`. See the [annotation read assessment](rails_stimulus_json_workspace_plan.md#annotation-read-assessment) for contracts, measurements and verification.

## Angular parity: changes kept after the 2026-10-17 review

The parity review compared these with Legacy (`8ceb99e9`, replayed on :3001) and found no recorded decision for any of them. On 2026-10-17 the user chose which to restore. The ones below were not chosen, so they stay. Item-level evidence is in [parity checklist](../manual-testing/angular-parity-checklist.md) rows 2, 11, 27, 36 and 104.

- **Deleting a try asks for confirmation** ("Are you sure you want to delete … This cannot be undone."). Legacy deleted immediately. Kept because the deletion can't be undone.
- **Annotations tab intro copy** fixes Legacy's typos ("help your remember") and shortens the second paragraph.
- **The knob value input does not auto-grow.** Removed on `main` by Eric Pugh in `a3e87c89` ("autogrow … doesn't even get used … so eliminate"). The input still widens to fit its value, through CSS (`field-sizing`) rather than the removed script.

Rerun My Searches! keeping the drawer open was listed with these but is not a change: Legacy keeps it open too (`mainCtrl.js` stores `devSettings` for this), and `e3605dc5` restored it.

**Revisit if:** users report missing the Legacy behaviour for any of these.

## [PREEXISTING] Wizard TLS reload exposes basic-auth credentials

The `http`↔`https` switch is a cross-origin navigation, so browser storage and `Secure` session cookies cannot provide a direct handoff. A short-lived, single-use opaque token could retrieve server-side pending state without sharing those cookies, keeping the credential itself out of browser history and URL logs. Redemption over plaintext `http` would still carry transport risk. This mitigation is deferred, not technically impossible.

## [PREEXISTING] Wizard TLS reload loses endpoint-specific settings

The same server-side handoff could preserve the full pending endpoint configuration (headers, mapper code, field selections), including explicit empty values, without reapplying engine defaults over it. This work is deferred; currently users re-enter those settings after the switch.

## [PREEXISTING] Stored search-endpoint credentials are serialized to members

**Why deferred:** Plain `http` search engines must remain supported, and direct browser searches against them need the stored `api_basic_auth_credential` and custom headers in the client. Withholding secrets means mandatory server-side proxying, which a direct browser search cannot use; an HTTPS-hosted Quepid also cannot call `http` engines from the browser (mixed content). Needs a decision on the credential-sharing contract before any change.

**Location:** `app/models/concerns/maskable_credential.rb:21-28`, `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder:11-15`, `app/views/api/v1/tries/_try.json.jbuilder:22-25`

`api_basic_auth_credential` is returned in full unless `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is enabled (default false), so shared endpoint members receive stored credentials in endpoint and try responses.

**Fix direction if revisited:** Never serialize credentials or custom secret headers; return a presence-only value and proxy server-side. Make this unconditional rather than flag-dependent.
