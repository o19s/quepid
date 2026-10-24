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

## Examples

You don't write these calls yourself: you ask the assistant in plain words, and it turns the
question into calls like the ones below. Each example starts with an imagined exchange, then shows
the call the assistant made. The ids come from the sample data.

### Asking questions

> **You:** What have I been working on lately?
>
> **Assistant:** Your five most recent active cases are "Typeahead: Dessert", "Typeahead: Meats",
> "Typeahead: Dairy", "10s of Queries" (20 queries) and "VESPA CASE" (3 queries).

```json
{
  "collection": "case",
  "search_pipeline": [
    {"$match": {"archived": false}},
    {"$sort": {"id": -1}},
    {"$limit": 5},
    {"$project": {"id": 1, "case_name": 1, "query_count": 1}}
  ]
}
```

> **You:** Do any of my cases already test "star wars"-type searches?
>
> **Assistant:** Two do: "SOLR CASE" has the query "star wars", and "VESPA CASE" has "star".

```json
{
  "collection": "query",
  "search_pipeline": [
    {"$search": {"text": {"query": "star"}}},
    {"$lookup": {"from": "case", "localField": "case", "foreignField": "_id", "as": "c"}},
    {"$project": {"query_text": 1, "case_name": "$c.case_name"}}
  ]
}
```

> **You:** In "10s of Queries", are most documents rated relevant or not?
>
> **Assistant:** Slightly more relevant than not: 110 ratings of 1 and 90 ratings of 0.

```json
{
  "collection": "rating",
  "search_pipeline": [
    {"$lookup": {"from": "query", "localField": "query", "foreignField": "_id", "as": "q"}},
    {"$match": {"q.case": 6}},
    {"$group": {"_id": "$rating", "ratings": {"$count": {}}}}
  ]
}
```

> **You:** Which searches did worst in the last snapshot? I want to start tuning there.
>
> **Assistant:** "official" (0.37), "c" (0.38) and "discharge" (0.39). All three returned 10
> results, so the problem is ranking, not missing matches.

```json
{
  "collection": "snapshot_query",
  "search_pipeline": [
    {"$match": {"snapshot": 16}},
    {"$lookup": {"from": "query", "localField": "query", "foreignField": "_id", "as": "q"}},
    {"$sort": {"score": 1}},
    {"$limit": 3},
    {"$project": {"query_text": "$q.query_text", "score": 1, "number_of_results": 1}}
  ]
}
```

> **You:** Has "10s of Queries" improved over the last few weeks?
>
> **Assistant:** No. All ten snapshots average 0.61 across the same 20 queries, so nothing has
> changed the results yet.

```json
{
  "collection": "snapshot_query",
  "search_pipeline": [
    {"$lookup": {"from": "snapshot", "localField": "snapshot", "foreignField": "_id", "as": "s"}},
    {"$match": {"s.case": 6}},
    {"$group": {"_id": "$snapshot", "avg_score": {"$avg": "$score"}, "queries": {"$count": {}}}}
  ]
}
```

> **You:** Who's been doing the judging in my book, and does anyone rate noticeably harsher?
>
> **Assistant:** Rater 5 did the most, 200 judgements. Raters 3 and 5 are the harshest, averaging
> about 0.5; raters 10 and 11 average almost 0.9. Raters 6 and 7 each left 10 pairs unrated.

```json
{
  "collection": "judgement",
  "search_pipeline": [
    {"$lookup": {"from": "query_doc_pair", "localField": "query_doc_pair", "foreignField": "_id", "as": "p"}},
    {"$group": {
      "_id": {"book": "$p.book", "rater": "$user_id"},
      "judgements": {"$count": {}},
      "avg_rating": {"$avg": "$rating"}
    }}
  ]
}
```

> **You:** Which of my cases can my teammates see?
>
> **Assistant:** Only "10s of Queries", shared with the team OSC.

```json
{
  "collection": "teams_case",
  "search_pipeline": [
    {"$lookup": {"from": "case", "localField": "case", "foreignField": "_id", "as": "c"}},
    {"$lookup": {"from": "team", "localField": "team", "foreignField": "_id", "as": "t"}},
    {"$project": {"case_name": "$c.case_name", "team_name": "$t.name"}}
  ]
}
```

### Making changes

> **You:** Set up a case called "Movie search", graded with nDCG@10, with the query "star wars";
> I'm after the original 1977 film. Document 11 is a perfect match.
>
> **Assistant:** Done. The case is created, the query added with that information need, and
> document 11 rated 3.
>
> **You:** Actually, drop that rating, I'll redo it later. Rename the case to "Movie search (title
> boost)", run it nightly, and share it with my team.
>
> **Assistant:** Rating removed, case renamed and set to nightly, and shared with OSC.
>
> *(a few weeks later)*
>
> **You:** We're done with "Movie search (title boost)". Archive it.

The assistant made one call per step:

```text
create_case          {"case_name": "Movie search", "scorer_id": 1}
create_query         {"case_id": 20, "query_text": "star wars", "information_need": "The original 1977 film"}
rate_document        {"query_id": 36, "doc_id": "11", "rating": 3}
delete_rating        {"query_id": 36, "doc_id": "11"}
update_case          {"case_id": 20, "case_name": "Movie search (title boost)", "nightly": true}
share_case_with_team {"case_id": 20, "team_id": 1}
archive_case         {"case_id": 20}
```

Each call returns the record it changed, so the assistant takes the new case's and query's ids
from the answers. A few things worth knowing:

- Adding a query the case already has returns the existing one instead of a duplicate.
- Rating a document again replaces its earlier rating.
- If the case draws on a book, each rating is also copied into the book as a judgement, just as
  when you rate in Quepid.

> **You:** Start a book for movie judgements on the same 0–3 scale, shared with my team. Tell
> judges that 3 means exactly the film the searcher asked for.

```text
create_book          {"name": "Movie judgements", "scorer_id": 1, "team_id": 1}
update_book          {"book_id": 2, "scoring_guidelines": "3 = exactly the film asked for"}
```

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
