// numberOfResultsMapper - Returns total number of search results.
// This is part of Vespa's fixed response envelope, not specific to any schema.
numberOfResultsMapper = function (data) {
  return data.root.fields.totalCount;
};

// docsMapper - Schema-agnostic: root.children[].id/relevance/fields are part of
// Vespa's response envelope for every schema, so nothing here is specific to the
// "news" schema. Which raw field displays as title/body/etc. is controlled entirely
// by the case's field_spec (e.g. "title:fields.title body:fields.abstract
// url:fields.url"), not by this mapper. Add fields, or point a case at a different
// Vespa schema, without ever touching this code.
docsMapper = function (data) {
  var docs = [];
  var count = data.root.fields.totalCount;

  if (count > 0 && data.root.children) {
    data.root.children.forEach(function (child) {
      var fields = Object.assign({}, child.fields);
      fields.score = child.relevance;
      docs.push({
        id: child.id,
        fields: fields
      });
    });
  }

  return docs;
};
