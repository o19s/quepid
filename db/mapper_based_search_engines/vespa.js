// numberOfResultsMapper - Returns total number of search results.
// This is part of Vespa's fixed response envelope, not specific to any schema.
numberOfResultsMapper = function (data) {
  return data.root.fields.totalCount;
};

// docsMapper - Schema-agnostic: root.children[].id/relevance/fields are part of
// Vespa's response envelope for every schema, so nothing here is specific to the
// "news" schema. Which raw field displays as title/body/etc. is controlled entirely
// by the case's field_spec (e.g. "title:title body:abstract url:url"), not by this
// mapper. Add fields, or point a case at a different Vespa schema, without ever
// touching this code.
//
// Each raw Vespa field (title, abstract, url, ...) is spread onto the doc at the
// top level, so field_spec can reference them directly (e.g. "title") instead of
// "fields.title". The nested "fields" sub-object is also kept alongside that,
// unchanged, because Quepid's server-side snapshot storage/compare-view
// (FetchService#setup_docs_for_query, the snapshots jbuilder views) read a mapped
// doc's "fields" key directly rather than resolving it through field_spec.
docsMapper = function (data) {
  var docs = [];
  var count = data.root.fields.totalCount;

  if (count > 0 && data.root.children) {
    data.root.children.forEach(function (child) {
      var fields = Object.assign({}, child.fields);
      fields.score = child.relevance;
      docs.push(Object.assign({
        id: child.id,
        fields: fields
      }, fields));
    });
  }

  return docs;
};
