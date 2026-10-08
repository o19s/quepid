# Historical Quepid comparison instance

For when to use this baseline rather than a pre-fix worktree, follow
[DEVELOPER_GUIDE.md — Manual testing tracker](../DEVELOPER_GUIDE.md#manual-testing-tracker).

Run `bin/legacy up` from the current checkout to start a persistent, isolated
baseline at **http://localhost:3001**, alongside the current app (normally
http://localhost:3000). First startup builds the historical Docker image,
installs its locked frontend dependencies, builds assets, and seeds its database.
The command waits for the app's HTTP health check. Use `bin/legacy logs` to check
startup and `bin/legacy status` to inspect containers.
`bin/legacy stop` stops only the historical stack; data is retained.

The baseline is pinned to `8ceb99e9a7f6db09d99d2ebdae4710a1646bdc65`
(2026-02-12), immediately before `dd24bf58` (“Starting to remove AngularJS code!”).
Its case workspace uses AngularJS and Bootstrap 3; management pages already used
Bootstrap 5. The archive lives under gitignored `tmp/legacy/source`, so starting
it does not switch the working tree or touch the index. Archive preparation is
atomic, so interrupted extraction can be retried. Its original `Dockerfile.dev`
supplies Ruby 3.4.8. The web and worker commands match its original
`Procfile.dev`; assets are built once, without watchers (historical esbuild watch
processes exit on detached stdin and terminate Foreman). The only source adaptation is a separate session
cookie key, since cookies on localhost are shared across ports.

The `quepid-legacy` Compose project has its own network, app image, MySQL container
and named database volume. MySQL is exposed at `127.0.0.1:33307`; the app at
`127.0.0.1:3001`. Override these with `LEGACY_APP_PORT` / `LEGACY_DB_PORT` on every
invocation if needed. It does not connect to the current stack's database,
Keycloak, Ollama, storage, credentials or asset directories. OAuth and local
Ollama integration are not provisioned in this baseline. Search endpoints in
sample data still refer to external services; mutating an external search index
is outside this isolation.

Sign in on each instance with `quepid+realisticactivity@o19s.com` / `password`.
Historical sample data is created from the historical schema and seed task;
the current database is not copied or restored. Seed completion is recorded in
the historical database; initialization uses a lock and transaction so failed
attempts roll back and can be retried. Existing untracked data blocks reseeding
unless the old filesystem marker and expected fixtures confirm completed setup.
Case and book IDs can differ.
For a parity comparison, select equivalent fixtures by name and verify their
queries, scorer, endpoint and ratings before comparing behavior. Import the same
compatible fixture into each instance when a scenario needs identical data.

Use Playwright MCP to navigate each URL in turn, execute equivalent steps, and
save full-viewport `*-before.png` (historical) / `*-after.png` (current) pairs under
`.playwright-mcp/<topic>/`. Inspect both images before claiming parity. Record the
baseline commit and fixture differences with the verification evidence. Existing
modern Playwright specs may depend on Stimulus markup and newer API contracts;
they are not automatically compatible with the historical app.

Do not use `bin/ui_diff_db_restore` for this workflow: it overwrites the current
development database. Do not switch source files in the current checkout to replay
historical behavior. Run historical commands in its existing app container:

```bash
docker compose --project-name quepid-legacy -f docker/legacy/compose.yml exec app bundle exec rails runner 'puts Case.pluck(:id, :case_name).inspect'
```

The baseline stays pinned across runs. Do not replace its archive or change its
revision while its server is running. Rebuilding or reseeding this stack should
never require stopping the current development server.

## Setup verification — 2026-10-07

Verified separate networks and database volume; historical database
`quepid_legacy_development` at migration `20260114150154`, current database
`quepid_development` at `20261007160000`, and different session cookie keys.
Historical seeds created six users, seven cases, one book and 24 queries.
HTTP sign-in succeeded; case 4 and all nine linked JS/CSS assets returned 200.
The current server retained its original container and start time.

Playwright MCP takeover completed with permission. All initially due scenarios
were attempted against equivalent fixtures where the baseline supports the flow;
`bin/manual_test_status --due-only` now reports 0/168 due. This is a freshness
check, not a parity pass: the tracker retains four failures and six blocked
scenarios, including historical share binding and unavailable provider coverage.
Actual scenario results and coverage limits are recorded in
`docs/manual-testing/tracking.yml`; inspected screenshot pairs are under
`.playwright-mcp/dual-parity/`. Identical historical case JSON was imported into
disposable cases because sample queries are randomly generated. The disposable
parity fixtures were removed from both databases; both servers remain running.

Setup recovery checks passed: failed archive extraction cleans up and a subsequent
attempt succeeds; in a disposable historical database, a simulated Solr outage
rolled back partial seed rows, the real retry succeeded, and repeated setup retained
all fixture counts. A fresh database was seeded despite a stale filesystem marker.
The existing historical data was adopted without reseeding; the disposable database
was removed. Ruby lint, shell syntax and diff checks passed.

## Supplemental sharing comparison

The pinned `8ceb99e9` cannot render sharing: `eba45615` deleted `teamSvc` while
`ShareCaseCtrl` still injects it. For scenario 3.6, an authorized separate archive
at `13bf23fff87f77e997440ba0c5fc5bff0c4378f1` (the deletion's parent) runs at
**http://localhost:3002**, using Compose project `quepid-legacy-sharing` and
gitignored `tmp/legacy-sharing/compose.yml`. It retains its own source directory,
network, MySQL volume, database `quepid_legacy_sharing_development` and session
cookie; MySQL is exposed on port 33308. Dependency locks match the pinned
baseline, so it reuses the existing historical image. Implementation files match
the earlier commit; setup uses its sample database config and a separate cookie.
Both original servers remain running. Inspect it with:

```bash
docker compose --project-name quepid-legacy-sharing -f tmp/legacy-sharing/compose.yml ps
```

Scenario 3.6 was replayed live on 2026-10-08 against equivalent disposable owned
and private cases and member/nonmember teams; fixtures were removed afterward.
Share/unshare persisted on both versions. Historical Teams rows remain stale
until reload; duplicate requests return 200/204 without duplicate memberships.
Historical private-case sharing accepts an unauthorized case ID and grants team
access; current rejects it. Both reject nonmember teams. These historical defects
were reproduced on the earlier server, not inferred from source alone. Current
duplicate alerts and tampered share/unshare checks passed. Inspected screenshot
pairs are under `.playwright-mcp/list-sharing-parity/`; detailed scope is recorded
in scenario 3.6 of the tracker.

Core sharing (6.5) was replayed on 2026-10-08 through the toolbar and Judgements
link. Both versions persisted share/unshare after reload; current cancellation
and routed team-load/share/unshare failures recovered correctly. Matching
disposable no-book users exercised the Judgements link, which current hides
when owned books are available. Historical Share closes on success and shows a
misleading no-teams prompt when all teams already share; current stays open with
updated lists and inline success. Inspected pairs and current error/retry shots
are under `.playwright-mcp/core-sharing-parity/`; scenario 6.5 records coverage
limits. Disposable cases, teams and users were removed; implementations and
servers retained.
