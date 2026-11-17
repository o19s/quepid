# Tasks

## 1. Extract the shared allowlist logic (no behavior change)

- [x] 1.1 Create `app/services/proxy_allowlist.rb` with `parse_network` and `parse_host` (moved from the lambdas in `config/initializers/customize_quepid.rb`) and `blocked?(address, hostname:)` (moved from `ProxyController#blocked_proxy_address?`), reading the existing `config.proxy_allowed_*` values. Verify with new `test/services/proxy_allowlist_test.rb` cases for the current accept/reject syntax: `10.0.5.0/24`, `192.168.1.50`, `10.0.0.0/99`, `search.internal`, `SEARCH.Internal.` (normalized), `*.internal`, `http://x`, `10.1.2.3` as a host.
- [x] 1.2 Switch the initializer to call `ProxyAllowlist.parse_*`, keeping the same warnings (same variable names in the message) and the same `config.proxy_allowed_networks` / `proxy_allowed_hosts` values. Verify by booting the dev server with `PROXY_ALLOWED_NETWORKS=10.0.0.0/99` and `PROXY_ALLOWED_HOSTS=*.internal` and confirming both warnings still appear in the Rails log.
- [x] 1.3 Switch `ProxyController#validate_proxy_url!` to `ProxyAllowlist#blocked?` and delete `blocked_proxy_address?`. Verify `docker compose exec app rails test test/controllers/proxy_controller_test.rb` passes with no test edits.

## 2. Flag and storage

- [x] 2.1 Add `config.proxy_allowlist_admin_managed` (`bool.deserialize(ENV.fetch('PROXY_ALLOWLIST_ADMIN_MANAGED', false))`) in `customize_quepid.rb`, and add a `with_proxy_allowlist_admin_managed` helper to `test/test_helper.rb` following `with_proxy_allowed_networks`. Verify the helper restores the original value, with a test.
- [x] 2.2 Document `PROXY_ALLOWLIST_ADMIN_MANAGED` in `.env.example` (default `false`) next to the other `PROXY_*` vars, including the warning about first-signup administrators, and add it to the ENV table in `docs/todo/QUEPID_FEATURES.md`. Verify by reading both files back.
- [x] 2.3 Add `- PROXY_ALLOWLIST_ADMIN_MANAGED=true` to the `app` service's `environment:` in `docker-compose.yml` (not `docker-compose.prod.yml`), with a comment saying it is on in dev so the e2e test covers the admin page. Recreating the dev server container is needed to pick it up: ask before doing it, since it interrupts the running server. Verify with `docker exec <dev-server-container> env | grep PROXY_ALLOWLIST_ADMIN_MANAGED` after recreation.
- [x] 2.4 Add a migration creating `proxy_allowlist_entries` (`kind`, `value`, `note`, `created_by_id`, `updated_by_id`, timestamps, unique index on `[kind, value]`) and run it in the dev server container. Verify `db/schema.rb` gains the table and `docker compose exec app rails db:rollback` / `db:migrate` both succeed.
- [x] 2.5 Add the `ProxyAllowlistEntry` model:
  - normalization through `ProxyAllowlist.parse_*`;
  - the uniqueness, breadth (/16, /48) and loopback/link-local overlap validations (design decision 4), applied on create and update;
  - `belongs_to :created_by` and `belongs_to :updated_by`, both `class_name: 'User', optional: true`;
  - matching `has_many ... dependent: :nullify` on `User`.

  Verify with `test/models/proxy_allowlist_entry_test.rb` covering:
  - `10.20.0.0/16` saved, `10.0.0.0/8` rejected;
  - `fd00::/48` saved, `fd00::/32` rejected;
  - `127.0.0.1`, `0.0.0.0/16`, `169.254.169.254` and `::ffff:169.254.169.254` rejected;
  - `*.internal` rejected;
  - duplicate rejected;
  - updating a saved entry to `10.0.0.0/8` rejected, with the stored value unchanged;
  - deleting the creator or the last updater nullifies that reference.

## 3. Proxy decisions with stored entries

- [x] 3.1 Extend `ProxyAllowlist#blocked?` with the stored-entry step (design decision 2), loading entries only when the flag is on. Verify with new `proxy_controller_test.rb` cases, one per spec scenario:
  - flag off: a stored `10.0.5.0/24` is ignored (blocked, and no SQL query for entries; assert with `assert_no_queries` or a query counter);
  - flag on: a stored network allows `10.0.5.20`;
  - flag on: a stored host resolving to `10.1.2.3` is allowed;
  - a stored host resolving to `127.0.0.1` or `0.0.0.0` is blocked;
  - a stored host resolving to `169.254.169.254` is blocked;
  - an address in both ENV and stored entries stays allowed after the stored entry is deleted;
  - editing a stored `10.0.5.0/24` to `10.0.6.0/24` makes `10.0.6.20` allowed and `10.0.5.20` blocked on the next request;
  - an ENV host resolving to loopback is still allowed (unchanged).
- [x] 3.2 Update `docs/todo/after-angular-removal.md` (P1 "Proxy SSRF controls are incomplete") so its allow-list sentence also names admin-managed entries. Verify by reading the paragraph back.
- [x] 3.3 Add edge cases to `docs/manual-testing/07-search-endpoints-and-mapper-wizard.md` §7.11 for flag on/off with a stored entry, and add the new files to that part's `paths` in `docs/manual-testing/tracking.yml`. Verify `bin/manual_test_status` lists 07 as changed.

## 4. Admin page

- [x] 4.1 Add `resources :proxy_allowlist_entries, except: [:show]` in `namespace :admin` and `Admin::ProxyAllowlistEntriesController < Admin::AdminController`:
  - a `before_action` returning 404 when the flag is off;
  - create sets `created_by` and `updated_by` to `current_user`;
  - update sets `updated_by` and permits only `value` and `note`;
  - create, update and destroy redirect with `status: :see_other`;
  - each create, update and destroy writes the `[proxy_allowlist]` log line, with old → new value on update.

  Verify with `test/controllers/admin/proxy_allowlist_entries_controller_test.rb`, following `announcements_controller_test.rb`, using `with_proxy_allowlist_admin_managed` to switch the flag:
  - flag off returns 404 for every action;
  - a non-admin is redirected with the alert for every action;
  - an admin creates a network and a host;
  - an admin edits a value and a note, and `updated_by` changes to the editing admin;
  - a submitted `kind` is ignored on update;
  - an invalid create or edit re-renders with 422 and the validation message, and the stored entry is unchanged;
  - destroy removes the entry;
  - the log line is emitted for all three actions, with old and new value on update.
- [x] 4.2 Add the index, new and edit views, with new and edit sharing a `_fields` partial (`page_header`, `page_create_button`, BS5 utilities, Turbo Drive):
  - a "From ENV (read-only)" section with no controls;
  - a "Managed here" table with kind, value, note, added by and at, last changed by and at, an Edit link, and a Delete button using `data-turbo-confirm`;
  - an edit form that shows the kind read-only;
  - a notice that entries apply to every logged-in user's proxy requests.

  Verify by viewing the index and an edit form with the flag on via Playwright MCP and taking screenshots.
- [x] 4.3 Add the sidebar link to `layouts/_admin_sidebar.html.erb`, rendered only when the flag is on. Verify with a controller/view test asserting the link's presence or absence on `/admin` for each flag value.
- [x] 4.4 Extend `test/playwright/admin.spec.ts` with a test that:
  - logs in as admin and adds a network entry with a unique note;
  - asserts it is listed with the admin's email;
  - edits its value and note, and asserts the new values and the "last changed by" column;
  - deletes it and asserts it is gone;
  - in `test.afterAll`, deletes any entry left behind;
  - fails with a message naming `PROXY_ALLOWLIST_ADMIN_MANAGED` and `docker-compose.yml` when the page returns 404. It does not skip.

  Verify by running `docker compose exec app yarn test:e2e test/playwright/admin.spec.ts` against the recreated dev server (task 2.3).
- [x] 4.5 Update DEVELOPER_GUIDE.md "Proxying to internal search engines" with a paragraph on `PROXY_ALLOWLIST_ADMIN_MANAGED`. It should say that entries are additive, cover the hard limits, note that no restart is needed after enabling, and warn about first-signup administrators. Verify by reading the section back.
- [x] 4.6 Add a numbered scenario to `docs/manual-testing/14-admin-area.md` for managing proxy allowlist entries (flag off 404, add, edit value and note with "last changed by" updated, invalid and too-broad rejected on add and edit, delete, ENV read-only), add `/admin/proxy_allowlist_entries` to 14.1's direct-URL gating edge case, and add the new paths to part 14 in `tracking.yml`. Then drive the scenario with Playwright MCP and record it in `tracking.yml`. Verify `bin/manual_test_status` no longer lists 14 as due.

## 5. Integration verification

- [x] 5.1 Run and confirm passing:
  - `docker compose exec app rails test`;
  - `docker compose exec app bundle exec rubocop`;
  - `docker compose exec app env RAILS_ENV=test bundle exec mutant run --since origin/main` (incremental; re-run only subjects with survivors after test edits);
  - `docker compose exec app yarn test:e2e test/playwright/admin.spec.ts`.

  Mutant outcome: the security subjects (`ProxyAllowlist#blocked?`, the stored-entry helpers, the hard limits, `ProxyAllowlistEntry#normalize_value` and `ProxyController#validate_proxy_url!`) have no survivors except two equivalent ones in `ProxyAllowlist#stored_hosts`: dropping `.to_set`, and using `map` instead of `filter_map`, since `include?` is never called with `nil`. Accepted without tests: survivors in `Admin::ProxyAllowlistEntriesController` (flash text, list order, `layout: false` on the 404, `self.logger`), which are cosmetic or equivalent and whose behavior the Rails and e2e tests already cover, and the exact CIDR error text in `ProxyAllowlistEntry#normalize_network`. Out of scope: `ProxyController#rack_header?` and `#render_response`, which are unchanged and only matched the diff because of a line shift.
- [x] 5.2 End-to-end check on the dev server:
  - a case using a proxied endpoint at an internal address fails with "disallowed address";
  - add the address's /32 on the admin page, and the same case query succeeds without a restart;
  - edit the entry to a different /32, and the query fails again;
  - edit it back, and the query succeeds;
  - delete the entry, and it fails again.

  Capture before/after screenshots with Playwright MCP.
- [x] 5.3 Run the representative visual suite per DEVELOPER_GUIDE "Routine visual regression checks" and confirm the only admin-area difference is the new sidebar link when the flag is on.
