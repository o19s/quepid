# frozen_string_literal: true

json.embedder_id @case.embedder_id
if @current
  json.embedder do
    json.embedder_id @current.id
    json.name        @current.name
    json.provider    @current.provider_definition&.label || @current.provider
    json.model       @current.model
    json.dimensions  @current.dimensions
    json.accessible  @embedders.include?(@current)
  end
else
  json.embedder nil
end

json.embedders @embedders do |embedder|
  json.embedder_id embedder.id
  json.name        embedder.name
  json.provider    embedder.provider_definition&.label || embedder.provider
  json.model       embedder.model
  json.dimensions  embedder.dimensions
end

# Vector status per query (QueryVectorStatus), keyed by query id, plus totals and
# whether a run is queued or under way.
json.vectors do
  json.running @running
  json.counts(@statuses.values.map(&:status).tally)
  json.queries(@statuses.transform_keys(&:to_s).transform_values(&:as_json))
end
