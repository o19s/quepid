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

Do not use `bin/ui_diff_db_sync` for this workflow: it copies the current
development database into the diff baseline's database, not the historical one. Do not switch source files in the current checkout to replay
historical behavior. Run historical commands in its existing app container:

```bash
docker compose --project-name quepid-legacy -f docker/legacy/compose.yml exec app bundle exec rails runner 'puts Case.pluck(:id, :case_name).inspect'
```

The baseline stays pinned across runs. Do not replace its archive or change its
revision while its server is running. Rebuilding or reseeding this stack should
never require stopping the current development server.

## Scripted side-by-side captures

For repeat comparisons of the same states, `scripts/legacy_comparison/` drives
both instances with Playwright and writes `<item>-legacy.png` / `<item>-current.png`
pairs, with the parts that differ outlined in pink. Run them on the host while
both servers are up:

```bash
node scripts/legacy_comparison/capture_wizard.mjs          # W1–W3: case wizard
node scripts/legacy_comparison/capture_tune_relevance.mjs  # T1–T14: Tune Relevance drawer
```

Item IDs are those of the 2026-10-17 parity review. Output goes to
`tmp/legacy_comparison/` (`--out <dir>` to change it); `--sides legacy` or
`--sides current` captures one side. Both scripts sign in as the sample-data user,
find fixtures by name ("10s of Queries", "Edinburgh University Website"), create
scratch cases, tries and endpoints, and delete them when done. States a screenshot
can't show (hover text, native dialogs) go to `notes-<side>.json`. Override the
instances with `LEGACY_URL` / `CURRENT_URL`; Legacy defaults to `127.0.0.1:3001`
so its session cookie stays apart from Current's on `localhost`. Add a capture
for a new item to the matching script, or start a new `capture_<surface>.mjs`
with the helpers in `lib.mjs`. Inspect every pair before claiming parity.

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
