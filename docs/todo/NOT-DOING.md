# Not doing

Deliberate decisions to leave something as it is, with the reasoning, so they are not re-raised as defects. Delete an entry if the reasoning stops holding, or move it back to [todo.md](todo.md) when it is prioritized.

## Missing Documents summary separator whitespace

By user choice, the searched-results summary removes whitespace around `&` separators in the italic query text. Preserve spaces within values such as `star wars` and leave submitted query parameters unchanged. This intentionally departs from Legacy's verbatim query display.

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

**Revisit if:** a concrete dependency design meaningfully simplifies consumers while preserving shared instances, startup order, Promise/error/microtask timing, method receivers and tuning's `draft()` versus wizard's `editable()`.

## [MIGRATION-FOLLOWUP] Share initial annotation reads between the list and graph

Rails already renders the list with the case page; only the graph makes an initial annotation JSON GET. Retain the separate projections: removing the remaining GET would change startup freshness and independent failure handling, while a shared store would add mutation and invalidation coordination. The measured saving does not justify that work. Snapshot catalogs also retain a fresh read on every modal open.

**Revisit if:** representative production measurements justify the coordination and a concrete design preserves list errors, graph refresh and `annotations:changed`.

## Angular parity: changes kept after the 2026-10-17 review

The parity review compared these with Legacy (`8ceb99e9`, replayed on :3001) and found no recorded decision for any of them. On 2026-10-17 the user chose which to restore. The ones below were not chosen, so they stay. Item-level evidence is in [parity checklist](../manual-testing/angular-parity-checklist.md) rows 2, 11, 27, 36 and 104.

- **Deleting a try asks for confirmation** ("Are you sure you want to delete … This cannot be undone."). Legacy deleted immediately. Kept because the deletion can't be undone.
- **Annotations tab intro copy** fixes Legacy's typos ("help your remember") and shortens the second paragraph.
- **The knob value input does not auto-grow.** Removed on `main` by Eric Pugh in `a3e87c89` ("autogrow … doesn't even get used … so eliminate"). The input still widens to fit its value, through CSS (`field-sizing`) rather than the removed script.

Rerun My Searches! keeping the drawer open was listed with these but is not a change: Legacy keeps it open too (`mainCtrl.js` stores `devSettings` for this), and `e3605dc5` restored it.

**Revisit if:** users report missing the Legacy behaviour for any of these.

## Angular parity: changes kept after the 2026-10-19 review

Same review as above; on 2026-10-19 the user chose to keep these. Evidence is in [parity checklist](../manual-testing/angular-parity-checklist.md) rows 5, 22, 24, 31, 48 and 89.

- **Query Options keeps the modal open on invalid JSON.** Legacy closed it on **Set Options** and then flashed "Please provide a valid JSON object.", losing the edit. Current shows the same flash with the modal still open, so the text can be fixed.
- **A `media:` field with no media extension shows its value as text.** Legacy showed only the label.
- **Media detection requires a literal dot.** Otherwise it is Legacy's rule (the extension anywhere in the value, case-sensitive, audio then image then video), but Legacy's regex left the `.` unescaped, so `/mp3s/list` would have embedded as audio.
- **A failed import keeps the Import modal open.** Legacy closed the modal and flashed the error. Current flashes the same error, also shows it in the modal's alert (scrolled into view, since the page flash is hidden behind the backdrop), and leaves the modal open with the file loaded for a retry.
- **Import CSV rows must match the header's column count.** Legacy rejected only lines with too many columns and listed them under the preview. Current also rejects short lines and reports each in the top alert ("line N: expected X columns but found Y"). Legacy's hint is kept for ratings and information needs: "every line needs N columns, like the header. Wrap queries that contain commas in double quotes."
- **An annotation's "Try No" shows the try number.** Legacy showed `score.try_id`, the try's database id (`154` for try 1), which matches nothing else in the UI. Changed in `0439ee00`.
- **An annotation's relative time uses `Intl.RelativeTimeFormat` wording** ("now", "1 second ago"). Legacy's `timeAgo` filter said "less than a minute ago". The difference only lasts for the first minute, and matching it would mean custom thresholds in the shared `relative-time` controller. Changed in `6656949e`.
- **The paste-JSON page at `/cases/import` is gone.** Legacy served it by URL only (no link to it) and created the case in the browser from pasted JSON. Removed on `main` by Eric Pugh in `e52cec3a` (#1642); the **Import Case from JSON** modal on `/cases` does the same job from a file, validated on the server.

**Revisit if:** users report missing the Legacy behaviour for any of these.

## [PREEXISTING] Wizard TLS reload exposes basic-auth credentials

The `http`↔`https` switch is a cross-origin navigation, so browser storage and `Secure` session cookies cannot provide a direct handoff. A short-lived, single-use opaque token could retrieve server-side pending state without sharing those cookies, keeping the credential itself out of browser history and URL logs. Redemption over plaintext `http` would still carry transport risk. This mitigation is deferred, not technically impossible.

## [PREEXISTING] Wizard TLS reload loses endpoint-specific settings

The same server-side handoff could preserve the full pending endpoint configuration (headers, mapper code, field selections), including explicit empty values, without reapplying engine defaults over it. This work is deferred; currently users re-enter those settings after the switch.

## [PREEXISTING] Stored search-endpoint credentials are serialized to members

**Why deferred:** Plain `http` search engines must remain supported, and direct browser searches against them need the stored `api_basic_auth_credential` and custom headers in the client. Withholding secrets means mandatory server-side proxying, which a direct browser search cannot use; an HTTPS-hosted Quepid also cannot call `http` engines from the browser (mixed content). Needs a decision on the credential-sharing contract before any change.

**Location:** `app/models/concerns/maskable_credential.rb:26-32`, `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder:11-15`, `app/views/api/v1/tries/_try.json.jbuilder:25`

`api_basic_auth_credential` is returned in full unless `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is enabled (default false), so shared endpoint members receive stored credentials in endpoint and try responses.

**Fix direction if revisited:** Never serialize credentials or custom secret headers; return a presence-only value and proxy server-side. Make this unconditional rather than flag-dependent.
