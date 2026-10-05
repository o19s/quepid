# Vector search with embedders

Quepid can turn each query's text into a vector and hand it to your search template, so a
case can tune kNN / dense or hybrid retrieval the same way it tunes lexical search. The
vector is computed once per query by an **embedder** and stored with the query; the search
engine never has to embed the query itself.

## Setting it up

1. **Create an embedder** under **Embedders** in the sidebar (`/embedders`): OpenAI, Voyage AI,
   Cohere, Ollama, or any OpenAI-compatible server (vLLM, Text Embeddings Inference, LM Studio,
   LiteLLM). Use the same model, size and settings your documents were indexed with — a
   query vector from a different model is meaningless to the index. The **Test** button
   embeds a sample query and shows the size it got back.
2. **Pick it for the case**: **Select embedder** in the case toolbar. Every query is then
   vectorised in the background; rows show "pending vectorisation" until theirs arrives.
3. **Use the vector in the try's query** as `#$qOption.query_vec##` (examples below).

Each query's options now hold `query_vec` and `query_vec_meta` — which embedder, provider,
model and size made the vector, and when (see **Set Options** on a query). When the embedder
or its settings change, rows show "vector outdated" and are redone automatically; a failed
attempt shows "vectorisation failed" with the provider's error on hover.

## Templates

`#$qOption.query_vec##` follows the same rules as every other placeholder:

- **On its own as a JSON value it becomes the array itself** — what kNN clauses expect.
- **Inside a longer string it is printed comma-separated** (`0.12,-0.04,…`), so write the
  brackets yourself.

### Elasticsearch / OpenSearch

```json
{
  "knn": {
    "field": "title_vector",
    "query_vector": "#$qOption.query_vec##",
    "k": 10,
    "num_candidates": 100
  }
}
```

Hybrid, combining it with a lexical clause:

```json
{
  "query": { "match": { "title": "#$query##" } },
  "knn": { "field": "title_vector", "query_vector": "#$qOption.query_vec##", "k": 10, "num_candidates": 100 }
}
```

OpenSearch's `knn` query takes it the same way: `{"query": {"knn": {"title_vector": {"vector": "#$qOption.query_vec##", "k": 10}}}}`.

### Solr

```
q={!knn f=title_vector topK=10}[#$qOption.query_vec##]
```

### Other engines

Anywhere a template can carry a JSON array (Qdrant's `"query"`, Vespa's
`input.query(q)`, a custom Search API), use `"#$qOption.query_vec##"` as the whole value.

## Background evaluation

Nightly runs and **Run case evaluation** build their requests with the same placeholder rules
as the case page (`QueryTemplate`, a port of splainer-search's template code, checked against
it by `test/fixtures/files/query_template_cases.json`), so they send the same vectors.

## Limits

- The vector is stored in the query's options and loaded with the case page; a 3072-dimension
  vector is roughly 40 KB per query. Prefer a smaller size (`Dimensions`) when the model
  supports one.
- Books don't keep vectors: a case created from a book is vectorised by its own embedder.
- Calls are made with the embedder owner's API key, by anyone the embedder is shared with.
