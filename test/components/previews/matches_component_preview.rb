# frozen_string_literal: true

# Preview for MatchesComponent. View at /rails/view_components in development.
class MatchesComponentPreview < ViewComponent::Preview
  def default
    render(MatchesComponent.new(
             doc_id:        'doc-42',
             doc_title:     'Ruby Programming Guide',
             doc_score:     3.14,
             explain_text:  "3.14 = weight(title:ruby in 42) [PerFieldSimilarity], result of:\n  3.14 = score(freq=1.0)",
             explain_raw:   '{"value": 3.14, "description": "weight(title:ruby in 42)", "details": []}',
             max_doc_score: 10.0
           ))
  end

  def minimal
    render(MatchesComponent.new(
             doc_id:       'doc-99',
             explain_text: '1.0 = ConstantScore'
           ))
  end
end
