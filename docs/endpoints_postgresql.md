# PostgreSQL Endpoints

This document explains how to point Quepid's **PostgreSQL** wizard preset at a database and
which SQL to put in the Query Sandbox for full-text, fuzzy, vector and hybrid search.

PostgreSQL has no HTTP search API, so Quepid connects to the database itself. The browser
sends the query to Quepid's proxy, and background runs use the same code path
(`PostgresSearchService`). That is why the preset always proxies requests.

**The preset is off by default.** Set `POSTGRES_SEARCH_ENABLED=true` to offer it. When it is
off, the wizard does not show the PostgreSQL tile, and the proxy and background runs refuse
`postgresql://` URLs, so existing PostgreSQL endpoints stop returning results.

**Prerequisite for the wizard and the case page:** the browser needs a fix in splainer-search.
Its SearchAPI searcher only recognises `http(s):` URLs, so it rewrites
`postgresql://host:5432/db` to `http://postgresql//host:5432/db` and the proxy rejects it.
Background runs are not affected. Until a splainer-search release includes the fix, change the
protocol check in `utilsSvc.ensureUrlHasProtocol` to `/^(https{0,1}:|[a-z][a-z0-9+.-]*:\/\/)/i`
in your build. See ADR 0010 (`docs/adr/0010-postgresql-search-backend.md`).

## Connecting

Search URL:

```
postgresql://<host>:5432/<database>?sslmode=require
```

`sslmode` is optional and defaults to `prefer`. Put the database user and password in the
endpoint's **Basic Auth** credential as `user:password`. Quepid stores it encrypted, but by
default the browser also receives it with the endpoint's settings and sends it to the proxy with
each query, so anyone who can use the endpoint can read the password. Set
`REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS=true` to keep it on the server: Quepid then leaves it
out of API responses and the proxy looks it up itself. The wizard is the exception: while you
create the endpoint, the browser sends the credential you typed to validate the connection.

**Use a read-only role.** Quepid runs every query in a read-only transaction with a 10 second
statement timeout and accepts only a `SELECT`. It refuses to search when the endpoint logs in as
a superuser, because a `SELECT` can call functions that act outside the transaction, such as
`dblink`, `pg_read_file` or `pg_terminate_backend`. Anyone who can use the endpoint can still
run any `SELECT` the role allows, so grant only what search needs, and don't make the role a
member of `pg_read_server_files`, `pg_signal_backend` or any role that can become a superuser:

```sql
CREATE ROLE quepid LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE shop TO quepid;
GRANT USAGE ON SCHEMA public TO quepid;
GRANT SELECT ON movies TO quepid;
```

A database on a private network or on localhost is blocked by default, just as the HTTP
proxy blocks internal search engines. With `PROXY_ALLOWLIST_ADMIN_MANAGED` on, an
administrator can allow its host or network on the admin **Proxy Allowlist** page.

## The query

The Query Sandbox holds JSON:

```json
{
  "sql": "SELECT id, title, overview, ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS score FROM movies WHERE search_vector @@ websearch_to_tsquery('english', $1) ORDER BY score DESC",
  "params": ["#$query##"]
}
```

- `params` are bound as `$1`, `$2`, ... The query text is never pasted into the SQL, so
  quotes or SQL in a user's query are just data. Put `#$query##` (and any other placeholder)
  in `params`, never inside `sql`.
- The SQL must return an `id` column, which becomes the document id that ratings attach to.
  Alias another key with `AS id` if needed. Every other column can be named in the case's
  field spec (`title:title, overview`).
- Quepid caps the rows at the try's **Number of Results to Show** (sent as `limit`, at most
  1000), so the SQL needs no `LIMIT` of its own.
- A result carries no total, so "Peek at the next page of results" is not offered. The
  "Already Rated Documents" lookup is also not offered, because it would need to know the
  table name.

## Recipes

### Full-text search (the default)

The table needs a `tsvector` column with a GIN index:

```sql
ALTER TABLE movies ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  to_tsvector('english', coalesce(overview, ''))
) STORED;
CREATE INDEX movies_search_vector ON movies USING gin (search_vector);
```

`ts_rank` scores with the document's own term counts, not BM25. A BM25 extension
(ParadeDB `pg_search`, `pg_textsearch`) plugs in the same way: only the `sql` changes.

### Typo tolerance with pg_trgm

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX movies_title_trgm ON movies USING gin (title gin_trgm_ops);
```

```json
{
  "sql": "SELECT id, title, overview, similarity(title, $1) AS score FROM movies WHERE title % $1 ORDER BY score DESC",
  "params": ["#$query##"]
}
```

### Vector search with pgvector

Give the case an embedder (see [vector_search.md](vector_search.md)) and pass the query's
vector as a parameter. A vector arrives as its JSON text (`[0.12, -0.03, ...]`), which
pgvector reads directly with `::vector`:

```json
{
  "sql": "SELECT id, title, overview, 1 - (embedding <=> $1::vector) AS score FROM movies ORDER BY embedding <=> $1::vector",
  "params": ["#$qOption.query_vec##"]
}
```

### Hybrid search with reciprocal rank fusion

Each leg returns its own top 100. The fusion adds `1 / (60 + rank)` from every leg a row
appears in:

```json
{
  "sql": "WITH lexical AS (SELECT id, row_number() OVER (ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC) AS rank FROM movies WHERE search_vector @@ websearch_to_tsquery('english', $1) LIMIT 100), semantic AS (SELECT id, row_number() OVER (ORDER BY embedding <=> $2::vector) AS rank FROM movies ORDER BY embedding <=> $2::vector LIMIT 100), fused AS (SELECT id, sum(1.0 / (60 + rank))::float AS score FROM (SELECT * FROM lexical UNION ALL SELECT * FROM semantic) AS legs GROUP BY id) SELECT movies.id, title, overview, score FROM fused JOIN movies USING (id) ORDER BY score DESC",
  "params": ["#$query##", "#$qOption.query_vec##"]
}
```
