# frozen_string_literal: true

# Preview for QueryExplainComponent. View at /rails/view_components in development.
class QueryExplainComponentPreview < ViewComponent::Preview
  def default
    render(QueryExplainComponent.new(query_id: 1))
  end

  def with_data
    render(QueryExplainComponent.new(
             query_id:               2,
             params_json:            { q: 'search', rows: 10 }.to_json,
             parsing_json:           { parsedQueryDetails: { query: 'parsed' } }.to_json,
             rendered_template_json: { template_output: { query: 'rendered' } }.to_json
           ))
  end
end
