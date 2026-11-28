# ADR 0010 — PostgreSQL as a search backend: Quepid connects to the database and runs the case's SQL

- **Status:** Proposed (built on `feature/postgresql-search-engine`, frutik/quepid#18)
- **Date:** 2026-11-25
- **Affects:** `app/services/postgres_search_service.rb` (new), `app/services/http_client_service.rb`,
  `app/controllers/proxy_controller.rb`, `app/models/mapper_based_search_engine.rb`,
  `db/mapper_based_search_engines/postgresql.js` (new), `docs/endpoints_postgresql.md` (new)
- **Builds on:** the mapper-based search engine pattern (Vespa, Qdrant), the proxy allowlist,
  [ADR 0006](./0006-search-engine-adapters.md) (search engine adapters; on branch
  `search-engine-adapters-plan`)

---

## 1. Context

Teams increasingly search with PostgreSQL itself instead of running a separate search engine:
built-in full-text search (`tsvector`, `ts_rank`), typo tolerance with `pg_trgm`, dense vectors
with pgvector, hybrid search fused with reciprocal rank fusion, and BM25 extensions such as
ParadeDB `pg_search` or `pg_textsearch`. They need the same thing from Quepid as anyone else: rate
results, score them, and compare tries.

Every engine Quepid supports today is an HTTP API. The browser calls it directly or through
Quepid's proxy (`ProxyController`), and background runs call it from `FetchService`. Both paths
end in `HttpClientService` on the server side. PostgreSQL has no HTTP API. It speaks its own wire
protocol, needs a database user and password, and is usually on a private network. Nothing in
the browser can open that connection.

## 2. Decision

**1. PostgreSQL is a mapper-based preset, not a new engine type.** It is a `postgresql` entry in
`MapperBasedSearchEngine::DEFINITIONS` on the generic `searchapi` engine, with its JavaScript in
`db/mapper_based_search_engines/postgresql.js`, exactly like Vespa and Qdrant. The wizard tile,
endpoint form, Query Sandbox, scoring, snapshots and background runs need no PostgreSQL-specific
code.

**2. Quepid's server runs the query.** A `postgres://` or `postgresql://` URL is handed by
`HttpClientService` to `PostgresSearchService`, which connects to the database, runs the SQL and
answers like a search API: a JSON `{ "rows": [...] }` body in a `Faraday::Response`. The proxy,
`FetchService` and the mapper wizard all reach the database through that one seam. The preset
always proxies requests, since only the server can connect.

**3. The query is the case author's SQL, and the search text is always a bind parameter.** The
Query Sandbox holds `{"sql": "...", "params": ["#$query##", ...]}`. Quepid fills in the
placeholders in `params`, and the values are bound as `$1`, `$2`, ... A placeholder that is
replaced by a whole value, such as `#$qOption.query_vec##`, arrives as JSON text, which pgvector
(`::vector`) and `jsonb` read directly. Any technique PostgreSQL supports is a change to the SQL
only. The search text never becomes part of the SQL.

**4. The server limits what the SQL can do.**

| Guard | How |
| --- | --- |
| Only a `SELECT` | The SQL runs as a subquery: `SELECT * FROM (<sql>) AS quepid_search LIMIT n`. |
| No writes | Each query runs in a `READ ONLY` transaction. |
| No superuser | The connection is refused when the server reports `is_superuser` at login. A `SELECT` can call functions that the read-only transaction does not stop (`dblink`, `pg_read_file`, `pg_terminate_backend`); a superuser can call all of them. |
| Bounded time | `SET LOCAL statement_timeout = '10s'`. |
| Bounded rows | `limit` comes from the try's Number of Results to Show (`requestArgsMapper`, as for Qdrant), at most 1000. |
| Reachable hosts | The host goes through the same `ProxyAllowlist` as the HTTP proxy, and the connection is pinned to the address that was checked (`hostaddr`), so DNS can't answer differently later. |
| Credentials | The endpoint's encrypted Basic Auth credential (`user:password`). During wizard validation, before the endpoint exists, the browser's forwarded `Authorization: Basic` header is used instead. |

**5. The response contract is small.** One object per row, with columns as keys. The SQL must
return an `id` column, which becomes the document id. There is no total, so no next-page support,
and no "Already Rated Documents" lookup, because building one would need the table name, which
only the case's SQL knows.

**6. The preset is off by default.** `POSTGRES_SEARCH_ENABLED=true` turns it on. Anyone who can
use a PostgreSQL endpoint can run any `SELECT` its role allows (see §4), so an installation opts
in rather than finding it already offered. When off, `MapperBasedSearchEngine.all` leaves the
preset out and `PostgresSearchService.handles?` is false, so the proxy and `HttpClientService`
treat `postgres://` URLs like any other non-HTTP URL and refuse them.

## 3. Options considered

1. **An HTTP layer in front of PostgreSQL** (PostgREST, or Supabase, which uses PostgREST).
   Quepid would need no server changes: a preset would `POST /rpc/<function>` like any search
   API. Rejected. Each query shape becomes a database function that someone must migrate into the
   database, so tuning means a deployment instead of an edit in the Query Sandbox. That removes
   the main reason to evaluate in Quepid. It also asks every team to run and secure another
   service.
2. **A new built-in `search_engine: 'postgresql'` with its own server-only path.** Rejected. It
   repeats what ADR 0006 sets out to remove: engine logic written separately for the browser and
   the server, with each engine special-cased in `FetchService` and `RunCaseEvaluationJob`.
3. **Connect in `HttpClientService` and reuse the mapper preset pattern (chosen).** It is small
   (one service and one routing check), every existing caller works unchanged, and it fits ADR
   0006: `PostgresSearchService` is transport, which ADR 0006 leaves with each runtime, and the
   mapper is what becomes an adapter.
4. **Plain SQL in the Query Sandbox**, with `bare_query_param: 'sql'` (as Vespa does for YQL) and
   the mapper rewriting each `'#$query##'` into a bind parameter. Considered and not adopted for
   now. It reads better and satisfies the wizard's "include `#$query##`" hint. But some paths
   replace `#$query##` with the raw text before the mapper runs, such as the Missing Documents
   query and Tune Relevance's field discovery. There the search text would become part of the
   SQL, so a quote in the query would break it.

## 4. Consequences

- **Anyone who can use an endpoint can run any `SELECT` its database role allows.** The
  read-only transaction stops writes, not reads. The role must be read-only and granted only the
  tables search needs; `docs/endpoints_postgresql.md` shows how. Quepid enforces only the
  worst case, a superuser login: it can't tell a role's other grants, or its membership in roles
  such as `pg_read_server_files`, from the login alone. This is the same trust an
  endpoint's HTTP credentials already carry, but a database role usually reaches more.
- **The proxy pairs the endpoint's stored credential with the URL the browser sends**, so a user
  with access to an endpoint could point it at a host they control and receive the password.
  HTTP Basic Auth through the proxy has the same weakness today. Binding a credential to its
  endpoint's host would close both; see §5.
- **The browser path needs a fix in splainer-search.** Its SearchAPI searcher passes every URL
  through `utilsSvc.ensureUrlHasProtocol`, which only recognises `http(s):`, so
  `postgresql://host:5432/db` becomes `http://postgresql//host:5432/db` and the proxy rejects it.
  Background runs are not affected. A one-line fix
  (`/^(https{0,1}:|[a-z][a-z0-9+.-]*:\/\/)/i`) makes the wizard and case page work end to end.
  Under ADR 0006 the adapter builds the request URL itself, so this dependency goes away.
- **Query behaviour belongs to the SQL, not to Quepid.** For example, `websearch_to_tsquery`
  requires every term, so in a hybrid query the full-text half often returns nothing for
  multi-word queries, and the fusion becomes pure vector search. That is fixed in the SQL
  recipe (match any term, rank by how many match), not in code.
- **The connection tries only one address.** Every address the host resolves to is checked
  against the allowlist, but only the first goes to libpq as `hostaddr`. If a host has both IPv6
  and IPv4 addresses, the IPv6 one comes first, and Quepid's server has no IPv6 route, the query
  fails with a 502. A plain libpq connection would fall back to IPv4. We decided to support one
  address: database hosts usually have a single address. libpq accepts comma-separated
  `host`/`hostaddr` lists, so passing all checked addresses would add failover without losing
  the pinning if this becomes a problem.
- **Each query opens a new connection**, so a background run pays connect, TLS and
  authentication for every query. This is marked as a shortcut in the code.
- **No new dependencies:** the `pg` gem is already in the Gemfile, because Quepid can use
  PostgreSQL as its own database.
- **Testing:** the database tests run against the test database's own server and are skipped
  under MySQL. The `test-postgresql` CI job runs them. They log in as a plain role,
  `quepid_search_test`, which they create if missing, because the test database user is usually
  a superuser.
- **Only a `SELECT` is enforced by PostgreSQL, not by parsing.** The subquery wrapper, the
  single-statement protocol of `exec_params` and the read-only transaction refuse a second
  statement, a commented-out wrapper, a data-modifying `WITH`, `SELECT INTO`, `FOR UPDATE`,
  `nextval` and switching the transaction back to read-write. Parsing the SQL in Quepid (for
  example with `pg_query`) would add a dependency and reject legitimate SQL without closing more.

## 5. Open questions

1. Fix `ensureUrlHasProtocol` upstream in splainer-search, or wait for ADR 0006's adapters to
   take over request building?
2. Should a stored credential be bound to its endpoint's host, for PostgreSQL and HTTP Basic Auth
   alike, so the proxy never sends it anywhere else?
3. Should the default and the documented hybrid recipe use any-term full-text matching instead of
   `websearch_to_tsquery`'s all-terms behaviour?
4. Is one connection per endpoint, kept for the length of a background run, worth adding?
