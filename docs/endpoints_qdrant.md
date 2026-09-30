# Qdrant Endpoints Structure

This document explains how to stand up a Qdrant collection that Quepid's **Qdrant** wizard
tile can search, and how to run both lexical (BM25) and dense retrieval against it.

Quepid talks to Qdrant through a single endpoint, the collection's query API:

```
POST https://<cluster-id>.<region>.cloud.qdrant.io/collections/<collection>/points/query
```

Note the shape: the URL is **collection-scoped**. Pasting the cluster root into the wizard is
the most common setup mistake — the root does not answer `/points/query`, so the wizard's
validation step reports "we're not getting any search results from your Search API" even
though the cluster is healthy.

Qdrant authenticates with its own `api-key` header rather than HTTP Basic, which is why the
preset ships `supports_basic_auth: false` and puts a placeholder in Custom Headers.

## Prerequisites

A Qdrant cluster (Cloud or self-hosted) and an API key. Everything below assumes:

```bash
export QDRANT_URL='https://<cluster-id>.<region>.cloud.qdrant.io'
export QDRANT_API_KEY='<your-qdrant-api-key>'
```

Qdrant Cloud serves REST on 443, so the port is optional; `:6333` works too and is what a
self-hosted cluster normally uses. Never paste a real key into a file you commit — the
examples read it from the environment.

Two models appear below. `qdrant/bm25` is computed **locally inside the cluster**, so it
works everywhere, including self-hosted. Dense models such as
`sentence-transformers/all-minilm-l6-v2` run through **Qdrant Cloud Inference**, which is a
Cloud feature — on a self-hosted cluster you embed the text yourself and upsert raw vectors
(see "Precomputed vectors" below).

## 1. Create the collection

One collection can carry several named vectors. This one has both, so the same documents can
be searched lexically and semantically:

```bash
curl -X PUT "$QDRANT_URL/collections/quepid_demo" \
  -H "api-key: $QDRANT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors":        { "dense": { "size": 384, "distance": "Cosine" } },
    "sparse_vectors": { "bm25":  { "modifier": "idf" } }
  }'
```

```json
{"result":true,"status":"ok","time":0.152718116}
```

Two details matter:

- **`"modifier": "idf"`** on the sparse vector. BM25 scoring needs the inverse document
  frequency term, and Qdrant only computes it when the vector is declared this way. Without
  it you get raw term-frequency scoring, not BM25.
- **`size: 384`** must match the dense model's output dimensions. `all-minilm-l6-v2` emits
  384 floats; a different model means a different size, and Qdrant rejects a mismatch at
  upsert time.

Vector names are fixed at creation. Qdrant cannot add a new named vector to an existing
collection, so decide up front whether you want the dense one — retrofitting it means
recreating the collection and reindexing.

## 2. Add documents

Passing `{"text": ..., "model": ...}` where a vector is expected makes Qdrant embed the text
itself, so the raw documents never have to leave your machine as vectors:

```bash
curl -X PUT "$QDRANT_URL/collections/quepid_demo/points?wait=true" \
  -H "api-key: $QDRANT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "points": [
      {
        "id": 1,
        "vector": {
          "bm25":  { "text": "Star Wars. A long time ago in a galaxy far, far away, rebels fight the Galactic Empire and a young farm boy discovers the Force.", "model": "qdrant/bm25" },
          "dense": { "text": "Star Wars. A long time ago in a galaxy far, far away, rebels fight the Galactic Empire and a young farm boy discovers the Force.", "model": "sentence-transformers/all-minilm-l6-v2" }
        },
        "payload": { "title": "Star Wars", "overview": "Rebels fight the Galactic Empire.", "movie_id": 1 }
      },
      {
        "id": 7,
        "vector": {
          "bm25":  { "text": "The Terminator. A cyborg assassin travels back in time to kill the mother of the future resistance leader.", "model": "qdrant/bm25" },
          "dense": { "text": "The Terminator. A cyborg assassin travels back in time to kill the mother of the future resistance leader.", "model": "sentence-transformers/all-minilm-l6-v2" }
        },
        "payload": { "title": "The Terminator", "overview": "A cyborg assassin travels back in time.", "movie_id": 7 }
      },
      {
        "id": 8,
        "vector": {
          "bm25":  { "text": "The Matrix. A hacker learns reality is a simulation and joins a rebellion against the machines.", "model": "qdrant/bm25" },
          "dense": { "text": "The Matrix. A hacker learns reality is a simulation and joins a rebellion against the machines.", "model": "sentence-transformers/all-minilm-l6-v2" }
        },
        "payload": { "title": "The Matrix", "overview": "A hacker learns reality is a simulation.", "movie_id": 8 }
      }
    ]
  }'
```

```json
{"result":{"operation_id":1,"status":"completed"},"status":"ok",
 "usage":{"inference":{"models":{"sentence-transformers/all-minilm-l6-v2":{"tokens":570}}}}}
```

The text embedded is `title + overview` concatenated, not the title alone — retrieval quality
depends far more on what you put into the vector than on the query syntax.

`?wait=true` makes the write synchronous. Without it the call returns `acknowledged` and a
query issued immediately afterwards may find nothing, which looks exactly like a broken
endpoint.

The `payload` is what Quepid displays and rates. `id` is the Qdrant point id and must be an
unsigned integer or a UUID — arbitrary strings are rejected. If your natural key is a string,
keep it in the payload (as `movie_id` above) and point the case's id field at it.

### Precomputed vectors

Without Cloud Inference, embed the text with your own model and send the numbers:

```bash
curl -X PUT "$QDRANT_URL/collections/quepid_demo/points?wait=true" \
  -H "api-key: $QDRANT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"points": [{"id": 1, "vector": {"dense": [0.013, -0.072, "... 384 floats ..."]},
                   "payload": {"title": "Star Wars"}}]}'
```

The same applies at query time: replace `{"nearest": {"text": ..., "model": ...}}` with
`{"nearest": [0.013, -0.072, ...]}`. Sparse vectors take an
`{"indices": [...], "values": [...]}` object instead of a plain array.

## 3. BM25 search

`using` names which vector to search. For BM25 that is the sparse one:

```bash
curl -X POST "$QDRANT_URL/collections/quepid_demo/points/query" \
  -H "api-key: $QDRANT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": { "nearest": { "text": "space rebels fight the empire", "model": "qdrant/bm25" } },
    "using": "bm25",
    "with_payload": true,
    "limit": 5
  }'
```

Against the full 20-document demo set:

```
   1   9.7603  Star Wars
   2   6.3752  The Empire Strikes Back
  16   4.0041  Fight Club
   3   2.9369  Return of the Jedi
```

Note the third hit. *Fight Club* scores because the document contains the literal token
"fight" — a textbook lexical false friend, and a good thing to have in a Quepid case when
you are measuring what dense retrieval buys you.

Only four documents come back for `limit: 5` because BM25 returns nothing for documents that
share no term with the query. A sparse search returning fewer rows than `limit` is normal,
not a truncation bug.

## 4. Dense retrieval search

Same request shape; a different model and a different `using`:

```bash
curl -X POST "$QDRANT_URL/collections/quepid_demo/points/query" \
  -H "api-key: $QDRANT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": { "nearest": { "text": "space rebels fight the empire",
                            "model": "sentence-transformers/all-minilm-l6-v2" } },
    "using": "dense",
    "with_payload": true,
    "limit": 5
  }'
```

```
   2   0.5967  The Empire Strikes Back
   3   0.5712  Return of the Jedi
   1   0.5695  Star Wars
   7   0.3153  The Terminator
  20   0.2786  Mad Max: Fury Road
```

The whole Star Wars trilogy ranks above everything else and *Fight Club* is gone. The
contrast is sharper on a query whose vocabulary does not match the corpus at all —
"killer robot from the future":

| Rank | BM25 | Dense |
|---|---|---|
| 1 | The Terminator (2.9446) | The Terminator (0.5103) |
| 2 | Back to the Future (2.9292) | Blade Runner (0.3483) |
| 3 | Blade Runner (2.9140) | The Matrix (0.3145) |
| 4 | — | Back to the Future (0.2993) |
| 5 | — | Alien (0.2868) |

BM25 ranks *Back to the Future* second on the word "future" and stops at three documents.
Dense retrieval finds *The Matrix* and *Alien*, which share no term with the query at all.

Scores are not comparable across the two: BM25 is unbounded and corpus-dependent, cosine
similarity is bounded by 1.0. Any scorer that thresholds on a raw score has to be retuned
when you switch a case between them.

## 5. Wiring it into Quepid

Pick the **Qdrant** tile in the Create a Case wizard, then:

| Field | Value |
|---|---|
| Endpoint URL | `https://<cluster-id>.<region>.cloud.qdrant.io/collections/quepid_demo/points/query` |
| Custom Headers | `{"api-key": "<your-qdrant-api-key>"}` |
| Test query | `{"with_payload": true, "limit": 1}` |

The test query is deliberately query-less: with no `query` and no `prefetch`,
`/points/query` degrades to returning points ordered by id, so validation succeeds against
any collection whether or not it has the sparse `bm25` vector.

The preset's default query params are the BM25 variant, with `#$query##` as the placeholder
Quepid substitutes:

```json
{"query": {"nearest": {"text": "#$query##", "model": "qdrant/bm25"}},
 "using": "bm25", "with_payload": true, "limit": 10}
```

To run the case against dense retrieval instead, edit that in the **Query Sandbox** — swap
the model and the `using` name:

```json
{"query": {"nearest": {"text": "#$query##", "model": "sentence-transformers/all-minilm-l6-v2"}},
 "using": "dense", "with_payload": true, "limit": 10}
```

Two cases pointed at the same endpoint with these two query params, side by side, is the
straightforward way to measure lexical against semantic retrieval on your own judgements.

### Things to know

- **No result count.** Qdrant's response envelope (`{status, time, result: {points: [...]}}`)
  carries no total, so `numberOfResultsMapper` can only report the documents already on
  screen. That is why the preset sets `supports_pagination: false` and why "Peek at the next
  page of results" does not appear — both call sites gate on `numFound > docs.length`, which
  a self-reported count can never satisfy.
- **`limit` must be a number.** Change it to `"10"` in the Query Sandbox and Qdrant's API
  rejects the request with a deserialization error. This is also why the page size is baked
  into the query params rather than driven by the pagination params.
- **The id field drives rated-document lookup.** With the case's id field left at `id`, the
  mapper filters already-rated documents with `has_id`; point it at a payload key instead and
  it switches to a `match`/`any` filter on that key. Both paths are handled by
  `ratedDocsQueryParamsMapper` in `db/mapper_based_search_engines/qdrant.js`.
- **Requests are proxied.** The preset sets `proxy_requests: true`, so Quepid calls the
  cluster server-side. A self-hosted cluster on plain `http://` therefore works from an
  `https://` Quepid, and the api-key never reaches the browser. It also means CORS is not
  involved — a cluster that refuses browser preflight is fine.

## 6. Give Quepid a read-only key

The key used to create and load the collection has manage scope: it can drop collections and
overwrite points. Quepid only ever reads, so issue it a separate, narrower key rather than
reusing the one from the steps above.

Qdrant's granular access control — available when the cluster reports `jwt_rbac: true` in
`GET /telemetry` — lets a key be scoped to read access, and optionally to a single
collection. In Qdrant Cloud you create one under **Cluster → API Keys**, choosing read-only
access and, where offered, the specific collection; the resulting token carries claims of
the shape:

```json
{ "access": [ { "collection": "quepid_demo", "access": "r" } ] }
```

versus the `{"access": "m"}` of a manage key. Decode any key you are unsure about at
`jwt.io`, or simply try a write with it:

```bash
curl -X DELETE "$QDRANT_URL/collections/scratch" -H "api-key: $QDRANT_READONLY_KEY"
```

A properly scoped key answers `403 Forbidden`. That is the key to paste into the wizard's
Custom Headers.

Treat any key that has been pasted into a chat, a ticket, a screenshot, or a shell history
file as compromised and rotate it in the Qdrant Cloud console. Keys belong in the
environment, never in a file you commit — the examples here read `$QDRANT_API_KEY` for
exactly that reason. Delete local scratch files holding a key once you are done with them.

Quepid stores what you paste into Custom Headers on the search endpoint record, and it does
not hide it again: the endpoint page renders it in a read-only editor
(`app/views/search_endpoints/_search_endpoint.html.erb`) and
`GET /api/search_endpoints` serves it verbatim. Search endpoints are shared with Teams, so
everyone on the team holds whatever that key can do — one more reason to scope it to read
access on one collection.

## Cleaning up

Drop the demo collection when you have finished testing:

```bash
curl -X DELETE "$QDRANT_URL/collections/quepid_demo" -H "api-key: $QDRANT_API_KEY"
```

Deleting the collection does not remove the Quepid case or its search endpoint. Those keep
pointing at a URL that now 404s, so delete or repoint them too, or the next person to open
the case sees the same "we're not getting any search results" box that an empty cluster
produces.
