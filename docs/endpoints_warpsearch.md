# WarpSearch Endpoints

[WarpSearch](https://warpsearch.io) is a hosted, serverless search engine. It answers Elasticsearch,
OpenSearch and Solr requests on compatible endpoints. Quepid supports it as a first-class
engine: pick the **WarpSearch** tile in the new-case wizard, or `WarpSearch` as the Search
Engine of a search endpoint (`search_engine: "warpsearch"`).

A WarpSearch endpoint speaks **exactly the OpenSearch query language**. Quepid sends it the same
requests as an [OpenSearch endpoint](./endpoints_opensearch.md), to WarpSearch's
OpenSearch-compatible API:

```
POST https://api.warpsearch.io/compat/opensearch/<collection>/_search
```

What sets WarpSearch apart from a self-hosted OpenSearch cluster is how you connect to it: the
API key header and CORS, both covered below.

## Prerequisites

You need a WarpSearch collection holding your documents, and an API key that can search it.
See the WarpSearch docs on [searching](https://warpsearch.io/docs/searching) and
[API keys, roles and rate limits](https://warpsearch.io/docs/access-control).

Use a key with the **`viewer`** role. That role is read-only: it can search, count, read
mappings and get documents by id, which is everything Quepid needs. Keys look like
`ws_live_...`. WarpSearch has no anonymous access, so every request needs one.

To check the key and the collection before you open Quepid:

```bash
export WARPSEARCH_API_KEY='ws_live_...'

curl -X POST https://api.warpsearch.io/compat/opensearch/books/_search \
  -H "Authorization: Bearer $WARPSEARCH_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{ "query": { "match_all": {} }, "size": 1 }'
```

## Setting up a case

1. In the new-case wizard, choose **Create a new Search Endpoint** and then the **WarpSearch** tile.
2. Replace `YOUR_COLLECTION` in the URL with your collection's name, for example
   `https://api.warpsearch.io/compat/opensearch/books/_search`.
3. Open **Advanced**. **Custom Headers** is pre-filled with:

   ```json
   {
     "Authorization": "Bearer ws_live_REPLACE_ME"
   }
   ```

   Replace `ws_live_REPLACE_ME` with your key.
4. Leave **Proxy requests through Quepid** checked (see [CORS and the proxy](#cors-and-the-proxy)).
5. Click **Continue**. Quepid runs a test search and lists the collection's fields, so you can
   pick the title and other fields to display.
6. Write the query in the OpenSearch Query DSL. The default pattern is:

   ```json
   {
     "query": {
       "multi_match": {
         "query": "#$query##",
         "fields": ["*"]
       }
     }
   }
   ```

You can also create the endpoint up front under **Search Endpoints**: pick `WarpSearch` as the
Search Engine, use `POST` as the API Method, and put the same header in Custom Headers.

## Authentication

WarpSearch accepts the key in any of these headers, so any of them works in Custom Headers:

| Header | Example |
|--------|---------|
| `Authorization: Bearer` (recommended) | `{"Authorization": "Bearer ws_live_..."}` |
| `Authorization: ApiKey` (what the wizard's **API Key** header type inserts) | `{"Authorization": "ApiKey ws_live_..."}` |
| `X-API-Key` | `{"X-API-Key": "ws_live_..."}` |

HTTP Basic authentication is **not** supported on WarpSearch's compatible endpoints, so the
wizard hides the Basic Authentication field for WarpSearch. Don't put the key in Basic Auth.

Custom headers are stored on the search endpoint and shared with everyone who can use it, for
example through a team. That's another reason to use a `viewer` key.

## CORS and the proxy

WarpSearch only answers browser requests from origins listed in the tenant's CORS settings.
Because of that, Quepid creates WarpSearch endpoints with **Proxy requests through Quepid**
switched on. Quepid's server then sends the request on the browser's behalf, including the
`Authorization` header, and CORS doesn't apply.

To search straight from the browser instead, add Quepid's origin (for example
`https://quepid.example.com`) to your WarpSearch tenant's allowed CORS origins, then uncheck
**Proxy requests through Quepid**. A Quepid instance configured to proxy every search endpoint
ignores the checkbox.

Background jobs, such as scheduled case evaluations, always call WarpSearch from Quepid's
server with the endpoint's custom headers, so CORS never affects them.

## What works

Everything that works on an OpenSearch endpoint works the same way here:

- Running queries, paging and rating results.
- Curator variables (Tune Relevance knobs) in the query DSL.
- **Show Only Rated** and the Document Finder's "Already Rated Documents", which filter on the
  case's id field.
- **Find and Rate Missing Documents**.
- Snapshots and snapshot comparison, which look documents up by id.
- Server-side case evaluation (`RunCaseEvaluationJob`).

The [OpenSearch endpoint guide](./endpoints_opensearch.md) describes the exact requests.

## Differences from OpenSearch

These come from WarpSearch itself. See
[Elasticsearch compatibility](https://warpsearch.io/docs/compat-elasticsearch) and
[OpenSearch compatibility](https://warpsearch.io/docs/compat-opensearch).

- **No explain output.** WarpSearch accepts `explain` in the request but returns no
  `_explanation`, so Quepid shows no score breakdown for documents.
- **No highlighting.** `highlight` is accepted with a warning, and hits carry no highlight section.
- **Scores differ** from Elasticsearch/OpenSearch for the same query. Matching documents are the
  same where a feature is supported, but compare rankings within WarpSearch, not across engines.
- **`_source` is rebuilt from stored fields.** Booleans come back as strings, and a `geo_point`
  comes back as `[lon, lat]`.
- **Deep paging** is limited by your plan's result window. Past it, WarpSearch returns
  `422 limit_exceeded`. Scroll, `search_after` and point in time aren't supported.

## Troubleshooting

| Response | Meaning |
|----------|---------|
| `401` | The key is missing or invalid. Check Custom Headers. |
| `403 forbidden` | The key has no role on this collection that allows searching. |
| `404 not_found` | The collection doesn't exist, or the key has no role on it. Check the collection name in the URL. |
| `400 query_error` / `unsupported_feature` / `invalid_field` | WarpSearch doesn't support part of the query, or a field doesn't exist. The response body names the problem. |
| `429 rate_limited` | Over the plan's rate or concurrency limit. Wait for `Retry-After`. Running many queries at once (e.g. **Run all**) can hit this on small plans. |
| `503 warming_up` | The collection is starting. Retry after `Retry-After`. |

If the wizard reports no results while proxying is off, the browser is most likely being
blocked by CORS. Turn the proxy back on, or add Quepid's origin to the tenant's CORS settings.
