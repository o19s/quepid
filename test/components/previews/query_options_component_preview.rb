# frozen_string_literal: true

# Preview for QueryOptionsComponent. View at /rails/view_components in development.
class QueryOptionsComponentPreview < ViewComponent::Preview
  def default
    render(QueryOptionsComponent.new(
      query_id: 1,
      case_id: 1,
      options_json: { "query_type" => "test", "weight" => 1.5 }
    ))
  end

  def empty
    render(QueryOptionsComponent.new(query_id: 1, case_id: 1, options_json: nil))
  end
end
