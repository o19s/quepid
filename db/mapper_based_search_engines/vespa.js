// numberOfResultsMapper - Returns total number of search results.
// This is part of Vespa's fixed response envelope, not specific to any schema.
numberOfResultsMapper = function (data) {
  return data.root.fields.totalCount;
};

// docsMapper - Schema-agnostic: root.children[].id/relevance/fields are part of
// Vespa's response envelope for every schema, so nothing here is specific to the
// "movies" schema this demo currently points at. Which raw field displays as
// title/body/etc. is controlled entirely by the case's field_spec (e.g.
// "title:title body:overview thumb:poster_path"), not by this mapper. Add fields,
// or point a case at a different Vespa schema, without ever touching this code.
//
// Each raw Vespa field (title, overview, genres, ...) is spread onto the doc at the
// top level, so field_spec can reference them directly (e.g. "title") instead of
// "fields.title". The nested "fields" sub-object is also kept alongside that,
// unchanged, because Quepid's server-side snapshot storage/compare-view
// (FetchService#setup_docs_for_query, the snapshots jbuilder views) read a mapped
// doc's "fields" key directly rather than resolving it through field_spec.
docsMapper = function (data) {
  const docs = [];
  const count = data.root.fields.totalCount;

  if (count > 0 && data.root.children) {
    data.root.children.forEach(function (child) {
      const fields = Object.assign({}, child.fields);
      fields.score = child.relevance;
      docs.push(Object.assign({
        id: child.id,
        fields
      }, fields));
    });
  }

  return docs;
};

// ratedDocsQueryParamsMapper - Builds a one-off query_params string that looks up exactly
// the given rated doc IDs, for the "Already Rated Documents" section of the
// Find-and-Rate-Missing-Documents modal. queriesSvc.js's filterToRatings() has no generic
// ID-filter syntax for a searchapi engine (unlike Solr's {!terms f=id} or ES's terms
// query), so that's left to whichever mapper actually knows its target API's query
// language.
//
// Unlike numberOfResultsMapper/docsMapper above, this IS specific to the "movies" schema
// (same coupling as additional_fields in MapperBasedSearchEngine's Vespa definition):
// Vespa's own document id (e.g. "id:movies:movies::603", the same string docsMapper puts
// on doc.id above) isn't itself a queryable field - "where id == ..." 400s with "Field
// 'id' does not exist" - so this filters on the schema's movie_id field instead, using
// the local id after the last "::".
ratedDocsQueryParamsMapper = function (ratedIds) {
  const movieIds = ratedIds
    .map(function (id) { return '"' + id.split('::').pop() + '"'; })
    .join(',');

  return 'yql=select * from sources * where movie_id in (' + movieIds + ')';
};
