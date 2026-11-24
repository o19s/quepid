// The "search API" here is Quepid itself: PostgresSearchService runs the case's SQL and
// answers { rows: [...] }, one object per result row, columns as keys.

// numberOfResultsMapper - The response carries no total, so this reports how many rows the
// query returned (same as Qdrant). "Peek at the next page of results" therefore never
// appears; the definition leaves supports_pagination off.
numberOfResultsMapper = function (data) {
  return data.rows.length;
};

// docsMapper - Schema-agnostic: every selected column is spread onto the doc so field_spec
// names columns directly (e.g. "title:title body:overview"), and kept under "fields" too,
// which FetchService's snapshot storage reads directly. The SQL must return an "id" column
// (alias one with "AS id" if the key is named differently); it is stringified because
// Quepid keys ratings by a string doc id.
docsMapper = function (data) {
  return (data.rows || []).map(function (row) {
    const fields = Object.assign({}, row);
    return Object.assign({ fields }, fields, { id: String(row.id) });
  });
};

// requestArgsMapper - "limit" caps the rows PostgresSearchService returns. Keep an explicit
// one; otherwise use the try's Number of Results to Show, as a number.
requestArgsMapper = function (args, numberOfRows) {
  const limit = Number(numberOfRows);
  if (!Object.hasOwn(args, 'limit') && Number.isFinite(limit)) {
    args.limit = limit;
  }
  return args;
};
