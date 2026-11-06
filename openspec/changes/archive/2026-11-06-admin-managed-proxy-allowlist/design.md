# Design

## Context

See proposal.md for motivation and specs/proxy-allowlist/spec.md for the required behavior.

Current state:
- `config/initializers/customize_quepid.rb` parses `PROXY_ALLOWED_NETWORKS` into `IPAddr`s and `PROXY_ALLOWED_HOSTS` into normalized hostnames once at boot. It stores them on `Rails.application.config.proxy_allowed_networks` / `proxy_allowed_hosts`, warning about and dropping invalid entries.
- `ProxyController#validate_proxy_url!` resolves the host with `Addrinfo.getaddrinfo` and checks every address with `blocked_proxy_address?`. The order of checks is:
  1. An ENV network match allows.
  2. Otherwise a link-local address is blocked.
  3. Otherwise an ENV-listed host is allowed.
  4. Otherwise loopback and the private ranges are blocked.
- No other HTTP caller uses this check.
- Tests swap the config values with `with_proxy_allowed_networks` / `with_proxy_allowed_hosts` in `test/test_helper.rb`. `test/controllers/proxy_controller_test.rb` covers both ENV variables.
- The admin area follows a plain-CRUD pattern:
  - Controllers subclass `Admin::AdminController` (`before_action :require_administrator`).
  - `Admin::AnnouncementsController` is the closest model to follow: index, new, create and destroy, redirecting with `status: :see_other`.
  - Pages use `page_header` / `page_create_button` and are linked from `layouts/_admin_sidebar.html.erb`.
- Production has no shared cache store configured (`production.rb` leaves `cache_store` commented out), so a per-process cache would go stale across Puma workers.
- `User#promote_to_first_administrator?` makes the first real signup an administrator.

## Goals / Non-Goals

**Goals:**
- One place that decides "may the proxy reach this address", used by the controller, with ENV and stored entries combined.
- One place that validates entries, so the boot-time ENV parsing and the admin form accept and reject the same syntax.
- Zero behavior change and zero database reads while the flag is off.

**Non-Goals:**
- Caching. One small indexed query per proxied request is cheap compared with the outbound HTTP call it guards.
- Fixing DNS rebinding or redirect revalidation. Out of scope, see the proposal.

## Decisions

### 1. Extract the parsing and the decision into a `ProxyAllowlist` class (app/services)

The initializer's two parsing lambdas and the controller's `blocked_proxy_address?` move into `app/services/proxy_allowlist.rb`:
- class methods `parse_network(string)` and `parse_host(string)` return the normalized value or an error message;
- an instance method `blocked?(address, hostname:)` decides a single resolved address.

The initializer calls the parse methods and keeps the warn-and-drop behavior and the same `config.proxy_allowed_*` values. The controller calls `blocked?`. Because initializers can't autoload reloadable `app/services` constants, the initializer runs the two ENV parses in `config.after_initialize`. Nothing reads them before the first request.

- *Why:* the admin model's validations must accept exactly what ENV accepts. Duplicating the hostname regexp and the `IPAddr` error handling would let them drift.
- *Alternative:* leave the logic where it is and call into the controller from the model. Rejected: a model shouldn't depend on a controller, and the initializer can't share a lambda with either.
- This moves existing code across three files. Per AGENTS.md, that churn needs approval, and approving this proposal counts as that approval. Behavior is pinned by the existing `proxy_controller_test.rb` cases, which must pass unchanged.

### 2. Decision order with stored entries

For each resolved address:
1. An ENV network match allows. Unchanged, including ENV's existing ability to list link-local or loopback explicitly.
2. A link-local address is blocked. Unchanged.
3. An ENV-listed host allows. Unchanged, including loopback.
4. **New, only when the flag is on:**
   - a loopback or unspecified (`0.0.0.0/8`, `::`) address is blocked;
   - a stored network match allows;
   - a stored host match allows.
5. Loopback and the private ranges are blocked. Unchanged.

- *Why:* putting the stored checks after the existing ENV and link-local checks means steps 1–3 and 5 run exactly as today, and stored entries can only turn a block into an allow inside the space the hard limits permit.
- Blocking loopback before stored hosts (step 4) enforces the spec's "admin host never reaches loopback".
- Stored networks can't include loopback anyway, because of save-time validation (decision 4).
- *Alternative:* merge stored entries into the ENV arrays. Rejected: it would give stored hosts ENV's loopback privilege, and the ENV arrays are read-only config.

### 3. Storage: one `ProxyAllowlistEntry` table

Columns:
- `kind`: string, `network` or `host`;
- `value`: string, normalized (canonical CIDR such as `10.0.5.0/24`, or a lowercase hostname without the trailing dot);
- `note`: string, optional, up to 255 characters;
- `created_by_id`: references `users`;
- `updated_by_id`: references `users`, set on create and on every edit;
- timestamps.

Unique index on `[kind, value]`. Validations run the shared `ProxyAllowlist.parse_*` methods plus the hard limits from decision 4, on both create and update. `kind` is not permitted in update params, so an edit can change only `value` and `note`.

The controller loads the stored entries once per `fetch`, and only when the flag is on: a single query for both kinds, parsed into `IPAddr`s and a host set.

- *Why one table with `kind`:* the admin page shows both kinds together, and the two have the same lifecycle.
- *Alternative:* a generic key/value settings table. Rejected: Quepid has none, and a list stored as one value loses per-entry attribution and unique constraints.
- *Alternative:* `Rails.cache` with invalidation on save. Rejected: there is no shared store in production (see Context).
- *Why `updated_by` and not a history table:* the page needs only "last changed by". The full history of values lives in the log lines (decision 5), the same as for deletes.
- *Delete on user removal:* `created_by` and `updated_by` both use `belongs_to optional: true`, with matching `has_many ... dependent: :nullify` on `User`, so deleting an admin user keeps the entries (attribution becomes "unknown").

### 4. Hard limits at save time

A network entry is invalid if:
- `prefix < 16` (IPv4) or `prefix < 48` (IPv6); or
- it overlaps `127.0.0.0/8`, `::1/128`, `0.0.0.0/8`, `::/128`, `169.254.0.0/16` or `fe80::/10`. The test is: either range includes the other's first address. The unspecified ranges are included because `0.0.0.0` connects to localhost on Linux (the reason the proxy already blocks `0.0.0.0/8`).

IPv4-mapped IPv6 input is normalized to IPv4 before checking.

- *Why at save time:* the admin gets an immediate validation message, instead of an entry that silently never works.
- *Defence in depth:* the request-time order in decision 2 still blocks link-local and loopback for stored entries even if a bad row were inserted directly.
- The /16 and /48 limits are constants in `ProxyAllowlist`, not configurable. Making them configurable would be one more ENV knob for a rare need. An operator who needs something wider uses ENV.

### 5. Flag and admin surface

- `config.proxy_allowlist_admin_managed` is read with the existing `bool.deserialize(ENV.fetch(...))` pattern in `customize_quepid.rb`.
- `Admin::ProxyAllowlistEntriesController` (index, new, create, edit, update, destroy) subclasses `Admin::AdminController` and has a `before_action` that raises `ActionController::RoutingError` (404) when the flag is off.
- Routes are always drawn: `resources :proxy_allowlist_entries, except: [:show]` in `namespace :admin`, matching announcements. A guard in the controller, rather than a route condition, keeps tests able to toggle the flag at runtime.
- The sidebar link renders only when the flag is on.
- The index shows two sections:
  - "From ENV (read-only)": both ENV lists, no controls.
  - "Managed here": stored entries with kind, value, note, added by and at, last changed by and at, an Edit link, and a Delete button using `data-turbo-confirm`.
  - The edit form shows the kind read-only and the value and note as fields. It shares a `_fields` partial with the new form, as announcements do.
  - A short notice links to the DEVELOPER_GUIDE section and states that entries apply to every logged-in user's proxy requests.
- Plain Rails views on Turbo Drive, the same as announcements. No Stimulus controller needed.
- Logging is a single `Rails.logger.info` line per create, update or destroy, emitted from the controller after it succeeds:
  - create and destroy: `"[proxy_allowlist] #{action} #{kind} #{value} by user #{id} <#{email}>"`;
  - update: `"[proxy_allowlist] updated #{kind} #{old_value} → #{new_value} by user #{id} <#{email}>"`, with the old value taken from `value_before_last_save`. A note-only edit logs the unchanged value on both sides.

### 6. Testing the flag in each state

- **Rails tests** cover both states. `with_proxy_allowlist_admin_managed(true/false)` switches `Rails.application.config.proxy_allowlist_admin_managed` within one test and restores it afterwards, following `with_proxy_allowed_networks`. Controller and proxy tests use it to check flag-off (404, stored entries ignored) and flag-on behavior side by side.
- **Playwright** drives the real dev server, whose ENV is fixed when the process boots, so it can't switch the flag per test. Instead, `docker-compose.yml` sets `PROXY_ALLOWLIST_ADMIN_MANAGED=true` in the `app` service's `environment:`. That overrides the developer's untracked `.env` and keeps `.env.example` and `docker-compose.prod.yml` at the default of off. The e2e test always runs the flag-on flow (add, list, edit, delete). If the page returns 404, the test fails with a message saying the dev server lacks the flag, rather than skipping, so missing coverage is visible.
  - *Alternative:* skip the test when the flag is off. Rejected: the test would quietly never run on most machines.
  - *Alternative:* an HTTP endpoint or test-only route to switch the flag. Rejected: it would be an HTTP switch for a security control.
  - Compose `environment:` changes need the dev container recreated, not just restarted. AGENTS.md permits recreating it between server sessions; this is a dev default, not a workaround for an agent mistake.

## Risks / Trade-offs

- **[Risk]** A compromised or careless administrator opens internal networks to every logged-in user.
  → Off by default; hard limits (decision 4); attribution and log lines; docs tell operators to enable the flag only once trusted administrators exist.
- **[Risk]** First-signup auto-admin on an open-signup instance could let a stranger manage the list.
  → Documented in `.env.example` and DEVELOPER_GUIDE next to the flag. The flag is off by default, so this needs an operator to opt in.
- **[Risk]** The refactor in decision 1 changes ENV behavior by accident.
  → Existing `proxy_controller_test.rb` cases are kept unchanged and must pass. New unit tests on `ProxyAllowlist.parse_*` cover the initializer's current accept and reject cases, including `10.0.0.0/99` and `*.internal`.
- **[Trade-off]** One extra query per proxied request when the flag is on. Accepted. It is indexed, tiny, and dwarfed by the outbound request.
- **[Trade-off]** Deleted entries and previous values of edited entries survive only in log lines, not in the database. Accepted: an audit table is more than this feature needs, and the logs are the operator's audit trail for other admin actions too.
- **[Risk]** With the flag on in dev, developers no longer see flag-off behavior day to day.
  → Flag-off is covered by Rails tests (decision 6) and by the manual-testing scenarios in parts 07 and 14, which say to restart with the flag off.
- **[Risk]** Stored entries widen what the known DNS-rebinding and redirect gaps can reach.
  → The `after-angular-removal.md` P1 item is updated to name admin-managed entries.

## Migration Plan

1. Deploy with the new migration. The flag is unset, so behavior is identical and the table stays empty.
2. The operator sets `PROXY_ALLOWLIST_ADMIN_MANAGED=true` and restarts once. From then on, list changes need no restart.
3. Rollback:
   - Set the flag to false and restart. Stored entries are ignored and kept.
   - Rolling back the code: the migration's `down` drops the table, and ENV entries are untouched throughout.
