# Running Quepid on PostgreSQL

Quepid supports three database adapters: MySQL (the default for development and
test), PostgreSQL, and SQLite. This document is the runbook for PostgreSQL. For
the adapter-agnostic background, see
[DEVELOPER_GUIDE.md § Choosing a database adapter](../DEVELOPER_GUIDE.md#choosing-a-database-adapter).

## TL;DR

```bash
echo 'DB_ADAPTER=postgresql' >> .env   # persists the choice
export DB_ADAPTER=postgresql           # so bin/setup_docker sees it too
bin/setup_docker                       # tears down and rebuilds the stack
bin/docker s
```

Quepid comes up on http://localhost:3000 backed by the `postgres` container.

## 1. How the adapter gets selected

`DB_ADAPTER` is the only switch. `config/database.yml` reads it and picks the
`postgres` connection block for the `development` and `test` environments;
`lib/db_adapter_env.rb` resolves the same value at boot, before any connection
exists, for the compatibility shims.

**Set it in two places**, because two different things read it:

| Where | Read by | What happens if you skip it |
| --- | --- | --- |
| `.env` | Docker Compose interpolation and the app container | The container runs on MySQL — `.env` is what actually reaches Rails |
| Your shell (`export`) | `bin/setup_docker` | Setup takes the `mysql2` branch and waits on `mysql:3306` before `db:reset`. The reset still runs against Postgres (the container has the right value), so it works — you just block on a service you don't need |

`docker-compose.yml` declares `DB_ADAPTER=${DB_ADAPTER:-mysql2}` under the app
service's `environment:`, which takes precedence over the `env_file: .env` entry.
Compose resolves `${DB_ADAPTER}` from your shell first and from the project
`.env` file second, so an `.env` entry is enough for the container. `bin/setup_docker`
is plain Bash and never reads `.env`, hence the export.

`DATABASE_URL` overrides everything and is how production selects an adapter —
see [§6](#6-production).

## 2. The postgres container

`docker-compose.yml` already defines it; nothing to add.

| | |
| --- | --- |
| Image | `postgres:17-alpine` |
| Container | `quepid_postgres` |
| Host port | `35432` |
| In-network | `postgres:5432` |
| User / password | `root` / `password` (`POSTGRES_USER` / `POSTGRES_PASSWORD`) |
| Data directory | `./volumes/postgres/data` on the host |

Credentials on the Rails side come from `.env`'s `DB_USERNAME`, `DB_PASSWORD`
and `DB_NAME`, which default to `root` / `password` / `quepid` — giving you the
databases `quepid_development` and `quepid_test`.

The app service `depends_on` postgres with a `pg_isready` healthcheck, so it
starts and is waited on with the rest of the stack.

The cluster is bind-mounted to `./volumes/postgres/data`, the same arrangement
`mysql` uses with `./volumes/mysql/data`; `volumes` is gitignored. A bind mount
is not a Docker volume, so the data survives container recreation and
`docker compose down -v` alike — `bin/setup_docker`'s teardown leaves the cluster
in place, and `db:reset` is what rebuilds the databases, exactly as on MySQL.

To throw the cluster away and start from a fresh `initdb`, delete the directory
while the container is down:

```bash
docker compose stop postgres
rm -rf volumes/postgres/data
docker compose up -d postgres
```

## 3. First-time setup

```bash
export DB_ADAPTER=postgresql
bin/setup_docker
```

`bin/setup_docker` tears the stack down (`docker compose down -v`), rebuilds,
installs JS deps, then for `postgresql` runs:

```bash
bin/docker r ./wait-for postgres:5432 --timeout=60 -- bin/rake db:reset
bin/docker r bin/rake db:migrate
```

followed by the sample-data seed. `db:reset` creates *both* `quepid_development`
and `quepid_test`.

No `bundle install` is needed to switch adapters — both Docker images install
the `mysql2`, `pg` and `sqlite3` gems at image build time. Also note that
`bin/docker r bundle install` does **not** persist: the wrapper uses
`docker compose run --rm` and gems live in the image. If you change the
`Gemfile`, rebuild with `docker compose build app`.

### Setting up without wiping MySQL

If you already have a working MySQL setup and just want to add Postgres beside
it, skip `bin/setup_docker` and prepare the databases directly:

```bash
export DB_ADAPTER=postgresql
docker compose up -d postgres
bin/docker r bin/rails db:create db:schema:load
bin/docker r bundle exec thor sample_data:sample_data   # optional seed data
```

## 4. Day-to-day

With `DB_ADAPTER=postgresql` in `.env`, the normal commands all work unchanged:

```bash
bin/docker s                       # start the app
bin/docker c                       # rails console
bin/docker r rails test            # full Minitest suite
bin/docker r rails test test/models/case_test.rb
```

Confirm what you are actually connected to:

```bash
bin/docker r bin/rails runner 'c = ActiveRecord::Base.connection; puts "#{c.adapter_name} #{c.current_database}"'
# => PostgreSQL quepid_development
```

A psql shell, from the host:

```bash
docker exec -it quepid_postgres psql -U root quepid_development
```

or with a local client against the published port:

```bash
psql -h 127.0.0.1 -p 35432 -U root quepid_development   # password: password
```

Dump and restore:

```bash
docker exec quepid_postgres pg_dump -U root quepid_development > quepid_$(date +%Y_%m_%d).sql
docker exec -i quepid_postgres psql -U root quepid_development < quepid_2026_09_09.sql
```

## 5. Running without Docker

Install PostgreSQL 14+ locally, or run just the container:

```bash
docker compose up -d postgres
```

`config/database.yml` uses host `postgres` inside Docker (`DOCKER_CONTAINER` is
set) and `127.0.0.1` otherwise. The container publishes 5432 on host port
**35432**, so a local Rails process needs the port pointed at it — set
`DB_HOST`/port to match, or run a native PostgreSQL on 5432 with a `root` role.
Then:

```bash
export DB_ADAPTER=postgresql
bundle install
bin/setup
bin/rails s
```

## 6. Production

Production ignores `DB_ADAPTER` and reads `DATABASE_URL`. With no `DATABASE_URL`
at all it falls back to SQLite at `storage/production.sqlite3`. For PostgreSQL:

```
DATABASE_URL=postgresql://user:password@host:5432/quepid
```

`docker-compose.prod.yml` ships with a MySQL service and
`DATABASE_URL=mysql2://root:password@mysql:3306/quepid`; point that at a
PostgreSQL instance to run production on Postgres.

## 7. Things to know before you write code

- **Case sensitivity differs from MySQL.** `db/schema.rb` carries MySQL
  collations. `config/initializers/postgresql_schema_compatibility.rb` maps
  `_bin` collations to PostgreSQL's `"C"` and *drops* the case-insensitive
  `_ci` ones, so columns that are case-insensitive on MySQL are case-sensitive
  here. Application code no longer relies on the MySQL behavior — email lookups
  and searches fold case in SQL — but new queries must not assume it. Matching
  MySQL exactly would need `citext` or a nondeterministic ICU collation, which is
  a schema decision rather than a compatibility shim.
- **The same initializer allows `size:`**, a MySQL text/blob width hint that
  means nothing to PostgreSQL, so the committed schema loads.
- **Never run `db:migrate` against PostgreSQL to author a migration.**
  `db/schema.rb` is dumped from MySQL and carries options no other adapter can
  reproduce. `config/application.rb` disables
  `dump_schema_after_migration` for every non-MySQL adapter to protect it, but
  the rule stands: write migrations and regenerate the schema on MySQL, and use
  PostgreSQL to run against an already-committed schema.
- **SQL functions that are spelled differently per adapter** — `RANDOM()`,
  natural log, and friends — go through `lib/adapter_functions.rb`, not inline
  branching. Getting one wrong returns wrong numbers instead of raising.
- **Portable SQL matters.** PostgreSQL declines to paper over things MySQL
  absorbs quietly: `SELECT DISTINCT` over `json` columns has no equality
  operator, `LIKE` against numeric columns is a type error, and queries without
  an explicit `ORDER BY` have no defined order. CI runs the full suite against
  all three adapters, so these surface as failures rather than in production.

## 8. Troubleshooting

**`ActiveRecord::NoDatabaseError: Database not found: quepid_test`**
The test database was never created (e.g. you switched adapters without a full
setup). Create and load it:

```bash
bin/docker r bin/rails db:create db:test:prepare
```

**Rails still reports `Mysql2` as the adapter.**
`DB_ADAPTER` did not reach the container. Check `docker compose config | grep DB_ADAPTER`
— it should print `DB_ADAPTER: postgresql`. If not, the `.env` entry is missing
or commented out. Recreate the container after changing it; a
`docker compose run` picks the value up on its next invocation.

**`could not translate host name "postgres"`**
You are running Rails outside Docker, where `config/database.yml` expects
`127.0.0.1`. `DOCKER_CONTAINER` is only set inside the app container.

**`connection refused` on port 35432.**
The container is not up: `docker compose up -d postgres`, then
`docker compose ps` to confirm it is healthy.

**`collation "utf8mb4_bin" ... does not exist` while loading the schema.**
`config/initializers/postgresql_schema_compatibility.rb` was not loaded — that
shim exists precisely to prevent this. Check that `DB_ADAPTER` is visible at
boot, since `DBAdapterEnv` reads it from `ENV` before any connection is made.
