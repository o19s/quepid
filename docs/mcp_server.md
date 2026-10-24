# MCP server

Quepid can serve an [MCP](https://modelcontextprotocol.io) endpoint so AI agents and MCP clients
(Claude Code, MCP Inspector, the MCP SDKs) can query and change Quepid data. It is built on
[ror-mcp-server](https://github.com/frutik/ror-mcp-server), and its collections follow the MCP
server of [quepid-api-unofficial](https://github.com/frutik/quepid-api-unofficial).

## Enabling it

The server is **off by default**. Set `MCP_SERVER=true` to mount it at `/mcp`:

```sh
MCP_SERVER=true bin/docker s
```

`docker-compose.yml` passes `MCP_SERVER` through to the app container. Any other value, or no
value, leaves `/mcp` unrouted (404).

## Authentication

The server takes the same personal API keys as the REST API (Profile → API keys), sent as
`Authorization: Bearer <key>`. A missing or unknown key, or a locked user, gets `401`.

Each request sees exactly what the key's owner sees in Quepid: their own cases, books, search
endpoints and scorers, plus those shared with one of their teams (the `*_involved_with` scopes
on `User`). Communal scorers are visible to everyone. Administrators get no extra rows.

## Connecting a client

```sh
claude mcp add --transport http quepid http://localhost:3000/mcp --header "Authorization: Bearer <key>"
```

The server is stateless (no `Mcp-Session-Id`), so it works behind several Puma workers.

Requests from a browser page on another origin get `403`; non-browser clients send no `Origin`
and are unaffected. To allow a browser-based client, list its origin in `c.allowed_origins` in
`config/initializers/ror_mcp.rb`. Request bodies over 4 MiB get `413`, and a `$group` producing
more than `max_limit` (1000) groups is refused; narrow it with `$match`.

## What it publishes

**Collections**, queried with `query_data_collections` and a MongoDB-style pipeline (`$match`,
`$lookup`, `$sort`, `$project`, `$group`, `$limit`), all read-only:

| Collection | Model | Notes |
| --- | --- | --- |
| `case` | `Case` | adds `owner_id`, `scorer_id`, `query_count` |
| `query` | `Query` | `case` is a `$lookup` reference |
| `rating` | `Rating` | case-side ratings |
| `book` | `Book` | adds `owner_id`, `query_doc_pair_count` |
| `query_doc_pair` | `QueryDocPair` | |
| `judgement` | `Judgement` | book-side judgements |
| `try` | `Try` | |
| `snapshot`, `snapshot_query` | `Snapshot`, `SnapshotQuery` | |
| `search_endpoint` | `SearchEndpoint` | no credentials, custom headers or mapper code |
| `scorer` | `Scorer` | |
| `team`, `teams_case` | `Team`, `TeamsCase` | `TeamsCase` is a read-only model of the join table |
| `ai_judge` | `AiJudge` | no `llm_key`, email or account columns |

`fields` in each collection is a whitelist: a column that isn't listed can't be filtered,
sorted or returned. There is no user collection, so `owner_id`/`user_id` are plain ids.

**Tools** that write, mirroring the REST API:

- cases: `create_case`, `update_case`, `archive_case`, `unarchive_case`,
  `share_case_with_team`, `unshare_case_from_team`
- queries and ratings: `create_query`, `update_query`, `delete_query`, `rate_document`,
  `delete_rating`
- books: `create_book`, `update_book`, `share_book_with_team`

Tools look records up through the same scopes as the collections, so they can only change what
the key's owner can reach. They record the same Ahoy analytics events as the matching REST
endpoints (`QuepidToolset#track`). MCP clients are programmatic, so their events are exempt from
Ahoy's bot filtering (`config/initializers/ahoy.rb`).

## Code

- `config/initializers/ror_mcp.rb`: the `MCP_SERVER` flag, server instructions, authentication
  and query limits
- `config/routes.rb`: the conditional `mount RorMcp::Engine, at: '/mcp'`
- `app/mcp/`: collections (`*_collection.rb`, based on `QuepidCollection`) and tools
  (`*_tools.rb`, based on `QuepidToolset`)
- `test/integration/mcp_server_test.rb`

Inspect and validate the server with:

```sh
bin/docker r env MCP_SERVER=true bundle exec rails ror_mcp:describe
bin/docker r env MCP_SERVER=true bundle exec rails ror_mcp:check
```

When you add or rename a column that a collection publishes, update its `fields`. Keep
credential columns out of `fields`.
