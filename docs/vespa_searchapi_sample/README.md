# Vespa Search API sample

A minimal Vespa Cloud application, used to prove out Quepid's "Search API"
`SearchEndpoint` type (`search_engine: searchapi`) against a real search engine.

## What's here

- `vespa/schemas/news.sd` — a tiny `news` schema (`news_id`, `title`, `abstract`,
  `url`, `category`) with a `bm25` rank profile that exposes `bm25(title)` /
  `bm25(abstract)` as match-features.
- `vespa/services.xml` — container + content cluster config. Declares two
  data-plane clients: `mtls` (for the `vespa` CLI) and `quepid-searchapi`
  (a bearer token client, referenced by id `quepid_searchapi_token`, used by
  Quepid's custom HTTP headers).
- `feed.jsonl` — 10 hand-written sample "news" documents to feed with
  `vespa feed feed.jsonl`.
- `mapper_code.js` — the `numberOfResultsMapper` / `docsMapper` JavaScript
  pasted into the Quepid SearchEndpoint's "Mapper code" field.

## Redeploying

```sh
vespa config set target cloud
vespa config set application <tenant>.<app-name>
vespa auth cert .                 # generates a client cert, writes security/clients.pem
vespa deploy --wait 300 vespa/
vespa feed feed.jsonl
```

The `quepid-searchapi` client's token (`quepid_searchapi_token`) has to be
created once in the Vespa Cloud console (Tenant → Account → Auth → Tokens),
then redeploy so the token client activates. The console gives you the bearer
secret once — put it in Quepid's SearchEndpoint "Custom Headers" field:

```json
{"Authorization": "Bearer <token-secret-from-console>"}
```

## Quepid SearchEndpoint config

- Search engine: `Search API`
- Endpoint url: `https://<your-endpoint>.z.vespa-app.cloud/search/`
- API method: `GET`
- Proxy requests: enabled (avoids CORS, keeps the bearer token off the client)
- Custom headers: as above
- Per-case Query Pattern, with `#$query##` as the substitution placeholder
  Quepid replaces with each query's text — this can be written plainly,
  **no URL-encoding needed**:

  ```
  yql=select * from news where title contains "#$query##" or abstract contains "#$query##"&ranking.profile=bm25
  ```

  Client-side (`splainer-search`'s `queryTemplateSvc.hydrate`), `#$query##`
  is regex-replaced with the query text *before* any URL is built, so those
  `#` characters never reach URL parsing. The remaining spaces/quotes get
  auto-percent-encoded by the browser's own `fetch()`/URL normalization when
  the request is actually issued — confirmed by inspecting the real outgoing
  request, which comes out correctly encoded even though the stored pattern
  is plain text.

- **Test query** (a *separate* field on the SearchEndpoint, used only by the
  Mapper Wizard's Fetch/"ping it" buttons — not by real per-case queries) can
  also be written plainly:

  ```
  yql=select * from news where title contains "bm25" or abstract contains "bm25"&ranking.profile=bm25
  ```

  That field is resolved server-side
  (`mapper_wizards_controller.rb#fetch_html` → naive
  `base_url + '?' + query_params` string concatenation via Faraday), which has
  no auto-encoding step — but Faraday/`URI` tolerate raw spaces and quotes
  there just fine (verified empirically). The one thing that *does* break it
  is a literal `#`, which gets parsed as a URI fragment delimiter and
  silently truncates everything after it — but since this field holds a
  literal, already-resolved test term rather than a `#$query##` template,
  that's a non-issue in practice.

## Keeping docsMapper schema-agnostic

`mapper_code.js` deliberately knows nothing about the `news` schema. It only
relies on Vespa's fixed response envelope (`root.fields.totalCount`,
`root.children[].id`/`.relevance`/`.fields`) — every Vespa app returns that
shape regardless of what fields you've indexed. Each mapped doc is:

```js
{
  id: child.id,
  fields: { /* every field Vespa returned, plus score */ },
  ...fields // the same fields spread onto the doc directly too
}
```

`child.id` is Vespa's own per-hit document id (e.g. `id:news:news::n3`), so
even the doc identifier requires no schema knowledge.

Which raw field becomes the case's "title", "body", etc. is controlled
entirely by the **`field_spec`** on the case's Try (the `fl`-equivalent) —
not by the mapper. Since every field is spread onto the doc's top level,
field_spec can reference it directly:

```
title:title sub:abstract sub:url
```

(Quepid's field_spec syntax also supports dot-notation paths — see
`normalDocsSvc.js#pathIndex` in `splainer-search` — so `fields.title` etc.
still works if you'd rather read from the nested object; the flattened
top-level fields exist to avoid needing that.)

`fieldSpecSvc.js` only recognizes a fixed set of type prefixes —
**`id`, `title`, `thumb`, `image`** are read as single fields; anything else
(body text, a URL, a score) must use **`sub:`** (or a bare token, which
auto-infers `sub` once `title` is already set — see the `id:id title:title
body` style field_spec examples in `test/fixtures/tries.yml`). A prefix like
`body:` or `url:` *parses* without error but is silently never read by
`assignFields` — verified by trying it and watching the field stay blank.
Point a case at a different Vespa schema, or add a new display field, by
editing field_spec — never the mapper.

**A related Quepid template bug, fixed as part of this sample:**
`app/assets/templates/views/searchResult.html` special-cases sub-field values
that look like a URL, rendering them as a clickable link — but it built the
href with `doc.doc[fieldName]`, a **flat** property lookup keyed by the
literal field_spec string (e.g. `"fields.url"`). Since `doc.doc` only has
flat own-properties (`id`/`fields`), that always resolved to `undefined`,
leaving the link blank — for *any* engine, not just Vespa, whenever a dotted
field_spec pointed at a URL-shaped value. Fixed in
`app/assets/javascripts/controllers/searchResult.js` (added
`$scope.resolveFieldValue`, a small dotted-path resolver mirroring
`normalDocsSvc.js`'s `pathIndex`) and `searchResult.html` (use
`resolveFieldValue(fieldName)` instead of `doc.doc[fieldName]`).

**Scope note:** this dotted-path resolution is a client-side capability
(`splainer-search`'s live in-browser query view, used while tuning a case).
Server-side snapshot persistence (`FetchService#setup_docs_for_query`, used by
`RunCaseEvaluationJob`/"Create snapshot") is not field_spec-aware — it just
reads whatever `id` and `fields` the mapper returned. Since our mapper already
supplies a schema-agnostic top-level `id` (`child.id`) and puts everything
else under `fields`, snapshot persistence works unchanged; extending
`FetchService` to also resolve `id` generically via field_spec (for mappers
that don't have a natural top-level id) would be a separate, larger change to
Quepid core, not something this sample needed.
