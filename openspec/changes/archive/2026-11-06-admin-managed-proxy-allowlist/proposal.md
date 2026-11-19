# Proposal

## Why

The Quepid proxy blocks private, loopback and link-local targets to prevent SSRF. Operators open internal search engines through `PROXY_ALLOWED_NETWORKS` and `PROXY_ALLOWED_HOSTS`, which are read once at boot. Operators report that every change to these lists means an environment change and a restart. On platforms where that means a full redeploy (Helm, ECS task definitions and similar), adding one internal Solr host becomes a deploy ticket. We want to keep the ENV lists as the authoritative baseline and let an operator opt in to managing additional entries from the Quepid admin area.

## What Changes

- New ENV flag `PROXY_ALLOWLIST_ADMIN_MANAGED`, default `false`. With it off, behavior is exactly as today: no admin page, and stored entries are never read.
- With the flag on, Quepid administrators get an admin page to add, edit and remove proxy allowlist entries (networks and hostnames). The page also shows the ENV entries, read-only.
- Entries saved in the app are **additive**: they widen the ENV lists and never remove or override an ENV entry.
- Admin-added entries have hard limits that ENV entries do not:
  - They can never reach link-local addresses (cloud metadata) or loopback. The unspecified addresses (`0.0.0.0/8`, `::`) count as loopback, since they connect to localhost on Linux.
  - Networks broader than /16 (IPv4) or /48 (IPv6) are rejected.
- Each entry shows who added it and who last changed it. Every add, edit and remove is logged, and an edit's log line records the old and new value.
- The development Docker Compose setup turns the flag on, so the end-to-end test always exercises the admin page. Production and `.env.example` keep it off.
- Changes take effect on the next proxied request, without a restart.

Unchanged:
- ENV parsing and its warnings for invalid entries.
- Every ENV allow/block decision the proxy makes today.
- The response shape for blocked requests (`400`, `proxy_error: "Proxy URL resolves to a disallowed address"`).
- Who may use the proxy: any logged-in user.

## Non-goals

- Removing or replacing the ENV variables.
- Per-team or per-user allowlists. The allowlist stays instance-wide and admin-owned.
- Fixing the existing DNS-rebinding and redirect gaps (`docs/todo/after-angular-removal.md`, "Proxy SSRF controls are incomplete"). This change widens what those gaps can reach only when an admin adds entries, and the docs will say so.
- Applying the allowlist to other outbound HTTP callers (`HttpClientService` users such as the mapper wizard and the DownloadPage tool), which do not use the proxy's check today.
- Moving other ENV settings (`REQUIRE_PROXY_*` and the rest) into the database.
- Changing an entry's kind (network ↔ host) by editing it. To do that, delete it and add a new one.

## Prior decisions

- `docs/todo/NOT-DOING.md` has no entry about managing proxy settings in the app. Its proxy items concern credential exposure and are unaffected.
- `docs/todo/after-angular-removal.md` (P1 "Proxy SSRF controls are incomplete") already notes that allowlists widen what rebinding and redirects can reach. Its wording will be updated to cover admin-managed entries.

## Capabilities

### New Capabilities
- `proxy-allowlist`: Which internal targets the Quepid proxy may reach. It covers the ENV baseline, the opt-in admin-managed additions and the hard limits that apply to them, and the admin page used to manage them.

### Modified Capabilities
None. No existing spec covers the proxy.

## Impact

- **Surfaces:**
  - Admin area (Rails pages, Turbo Drive): a new admin page and a sidebar link.
  - The proxy endpoint `/proxy/fetch`, which the case workspace uses when proxying is on, gains an extra allow source. Its behavior is unchanged while the flag is off.
- **ENV:** adds `PROXY_ALLOWLIST_ADMIN_MANAGED`. No changes to `PROXY_ALLOWED_NETWORKS` or `PROXY_ALLOWED_HOSTS`.
- **Dev setup:** `docker-compose.yml` sets the flag to `true` for the `app` service. The existing dev server container must be recreated to pick it up.
- **Code:**
  - `app/controllers/proxy_controller.rb`: address check.
  - `config/initializers/customize_quepid.rb`: ENV parsing, moved into a shared class.
  - New model, migration, admin controller, views and route.
  - `layouts/_admin_sidebar.html.erb`.
- **Data:** a new table for allowlist entries. No changes to existing tables.
- **Security:**
  - Turning the flag on means a compromised administrator account can open internal networks to every logged-in user's proxy requests. The hard limits bound this, but the operator is opting into that trust.
  - Quepid makes the first real signup an administrator, so operators should enable the flag only once an administrator account is in place.
- **Docs:**
  - `.env.example` and DEVELOPER_GUIDE.md ("Proxying to internal search engines").
  - The ENV table in `docs/todo/QUEPID_FEATURES.md`.
  - `docs/todo/after-angular-removal.md`.
  - Manual-testing parts 07 (7.11) and 14.
