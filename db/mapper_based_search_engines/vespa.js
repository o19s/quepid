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
// Vespa's own document id (e.g. "id:movies:movies::603") isn't itself a queryable field -
// "where id == ..." 400s with "Field 'id' does not exist" - only the schema's movie_id
// attribute is filterable. MapperBasedSearchEngine's id_field ('movie_id') makes this the
// case's doc id going forward, so ratedIds normally arrive already bare (e.g. "603");
// .split('::').pop() is a no-op then, and only actually strips anything for a case still
// using the old id_field: 'id' default (doc ids like "id:movies:movies::603").
//
// Returns JSON (matching MapperBasedSearchEngine's api_method: 'POST' + JSON query_params
// above) rather than a "yql=..." query string - this list of IDs has no fixed upper bound
// (it grows with however many docs are rated), so it's exactly the case a GET's URL-length
// limit would eventually break; POST's JSON body has no such limit.
ratedDocsQueryParamsMapper = function (ratedIds) {
  const idList = ratedIds
    .map(function (id) { return JSON.stringify(id.split('::').pop()); })
    .join(',');

  return JSON.stringify({ yql: 'select * from sources * where movie_id in (' + idList + ')' });
};

// nextPageArgsMapper - Given the resolved args used for the current page (already
// curator-var/placeholder-resolved - see Try#args/settingsSvc.previewArgs), returns the
// args for the next page. queriesSvc.js has no generic "advance to the next page" logic
// for a searchapi engine (splainer-search's searchApiSearcherFactory has no pager()
// implementation, unlike Solr/ES/Algolia/Vectara) since different mapper-based engines
// could paginate in entirely different ways - a numeric offset (Vespa's own convention,
// bumped here), a cursor/scroll token from the previous response, etc. - so that's left to
// whichever mapper actually knows its target API's pagination style. The UI only ever
// calls this when it already knows there's a next page (numFound > docs fetched so far),
// so no "is there more?" check is needed here - but a mapper that can't tell may return
// null instead, same contract as splainer-search's own pager().
//
// pageSize is only a fallback for when currentArgs has no hits of its own (e.g. a fresh
// try's args, before any search has run) - once a page has actually been fetched, its own
// hits value wins, so an explicit hits=.. a user typed into the Find Missing Docs query box
// (or the Query Sandbox) keeps being honored on every subsequent page instead of snapping
// back to the case's configured page size.
nextPageArgsMapper = function (currentArgs, pageSize) {
  const currentHits = currentArgs.hits ? parseInt(currentArgs.hits, 10) : pageSize;
  const currentOffset = currentArgs.offset ? parseInt(currentArgs.offset, 10) : 0;

  return Object.assign({}, currentArgs, {
    hits: String(currentHits),
    offset: String(currentOffset + currentHits)
  });
};
