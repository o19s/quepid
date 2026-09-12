// numberOfResultsMapper - Qdrant's POST /points/query response has no total-hits field:
// the envelope is { status, time, result: { points: [...] } } and nothing more. There is a
// separate POST /points/count endpoint, but a mapper only ever sees one response body from
// one URL, so the honest answer here is "how many results did this request return", the same
// thing the other mapper-based engines without a total report.
//
// The visible consequence is that "Peek at the next page of results" never appears for a
// Qdrant case - searchResults.html/targetedSearchModal.html both gate that button on
// numFound > docs.length, which can never be true when numFound IS docs.length. That is why
// the definition in app/models/mapper_based_search_engine.rb leaves supports_pagination at
// its false default and why there is no nextPageArgsMapper below; see the comment there for
// how the page size is set instead.
numberOfResultsMapper = function (data) {
  return data.result.points.length;
};

// docsMapper - Schema-agnostic: result.points[].id/score/payload is Qdrant's response
// envelope for every collection, so nothing here is specific to any one collection's payload.
// Which raw payload field displays as title/body/etc. is controlled entirely by the case's
// field_spec (e.g. "title:title body:overview thumb:poster_path"), not by this mapper. Point
// a case at a different Qdrant collection without ever touching this code.
//
// Each raw payload key is spread onto the doc at the top level, so field_spec can reference
// them directly (e.g. "title") instead of "payload.title". The mapped fields are also kept
// under a "fields" sub-object alongside that, because Quepid's server-side snapshot
// storage/compare-view (FetchService#setup_docs_for_query, the snapshots jbuilder views) read
// a mapped doc's "fields" key directly rather than resolving it through field_spec.
//
// Unlike Vespa's mapper, "id" is assigned AFTER the payload spread rather than before, so a
// collection whose payload happens to contain its own "id" key can't shadow the point id.
// The point id is Qdrant's actual primary key and the only thing a has_id filter matches on
// (see ratedDocsQueryParamsMapper below), so silently replacing it would break rated-doc
// lookup for that collection. A collection that genuinely wants a payload field as its
// Quepid doc id should point the case's id_field at that field by name (e.g. "movie_id") -
// the spread puts it at the top level and ratedDocsQueryParamsMapper handles it.
//
// Point ids are stringified because Qdrant ids are unsigned integers OR UUIDs, and Quepid
// stores ratings keyed by a string doc id either way; ratedDocsQueryParamsMapper converts
// the numeric ones back before filtering.
docsMapper = function (data) {
  const docs = [];

  if (data.result && data.result.points) {
    data.result.points.forEach(function (point) {
      const fields = Object.assign({}, point.payload);
      fields.score = point.score;
      docs.push(Object.assign({ fields }, fields, { id: String(point.id) }));
    });
  }

  return docs;
};

// ratedDocsQueryParamsMapper - Builds a one-off query_params string that looks up exactly the
// given rated doc IDs, for the "Already Rated Documents" section of the
// Find-and-Rate-Missing-Documents modal. queriesSvc.js's filterToRatings() has no generic
// ID-filter syntax for a searchapi engine (unlike Solr's {!terms f=id} or ES's terms query),
// so that's left to whichever mapper actually knows its target API's query language.
//
// Omitting "query" is deliberate and is Qdrant's documented behavior for /points/query: with
// no query and no prefetch the request degrades to returning the filtered points ordered by
// id, which is exactly what an ID lookup wants - there is nothing to score here.
//
// idField is the case's own id field (queriesSvc.js passes fieldSpec.id, i.e. whatever
// follows "id:" in the try's field_spec). Two genuinely different lookups hide behind it:
//
//   - "id" (the definition's default) means Qdrant's own point id, which is NOT a payload key
//     and so is not reachable by a payload match filter at all - it needs the dedicated
//     has_id condition. Point ids are an untagged unsigned-integer-or-UUID union, so a
//     digits-only id is converted back to a number here; sending "42" as a string makes
//     Qdrant try to parse it as a UUID and reject the request.
//   - anything else means a payload key, filtered with match/any (Qdrant's IN operator).
//     Values are passed through as the strings Quepid stores them as, deliberately without
//     the numeric conversion above: a payload value like an "007" SKU is a string in Qdrant
//     too, and coercing it to 7 would silently match nothing.
//
// limit is set explicitly because Qdrant defaults it to 10 - without it a query with more
// than ten ratings would only get its first ten back.
ratedDocsQueryParamsMapper = function (ratedIds, idField) {
  let condition;

  if ('id' === idField) {
    condition = {
      has_id: ratedIds.map(function (id) {
        return /^\d+$/.test(id) ? Number(id) : id;
      })
    };
  }
  else {
    condition = {
      key:   idField,
      match: { any: ratedIds.map(function (id) { return String(id); }) }
    };
  }

  return JSON.stringify({
    filter:       { must: [ condition ] },
    with_payload: true,
    limit:        Math.max(ratedIds.length, 1)
  });
};
