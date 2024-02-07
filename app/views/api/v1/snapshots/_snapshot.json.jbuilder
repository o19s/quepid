# frozen_string_literal: true

shallow ||= false

json.id     snapshot.id
json.name   snapshot.name
json.time   snapshot.created_at
json.has_snapshot_file snapshot.snapshot_file.present?

unless shallow
  json.scorer snapshot.scorer, partial: 'api/v1/scorers/communal_scorer', as: :scorer
  json.try snapshot.try, partial: 'api/v1/tries/try', as: :try
end

if with_docs
  json.docs do
    snapshot.snapshot_queries.each do |snapshot_query|
      docs = snapshot_query.snapshot_docs.map do |doc|
        {
          id:         doc.doc_id,
          explain:    doc.explain.blank? ? nil : JSON.parse(doc.explain),
          rated_only: doc.rated_only,
          fields:     doc.fields.blank? ? nil : JSON.parse(doc.fields),
        }
      end

      json.set! snapshot_query.query_id, docs
    end
  end
end

if with_docs
  json.queries do
    # filter out deleted queries from the snapshot via the .compact method.
    json.array! snapshot.snapshot_queries.collect(&:query).compact, partial: 'api/v1/queries/query', as: :query
  end
end

if with_docs
  json.scores do
    json.array! snapshot.snapshot_queries, partial: 'api/v1/snapshots/snapshot_query', as: :snapshot_query
  end
end
