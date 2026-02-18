# frozen_string_literal: true

# Preview for DocumentCardComponent. View at /rails/view_components in development.
class DocumentCardComponentPreview < ViewComponent::Preview
  def default
    doc = {
      id: "doc-42",
      position: 1,
      fields: { "title" => "Ruby Programming Guide", "description" => "A comprehensive guide." }
    }
    render(DocumentCardComponent.new(doc: doc, rating: "2", index: 0))
  end

  def with_explain
    doc = {
      id: "doc-99",
      position: 2,
      fields: { "title" => "Document With Explain" },
      explain: '{"value": 1.5, "description": "weight(title:ruby)"}'
    }
    render(DocumentCardComponent.new(doc: doc, rating: "", index: 1))
  end
end
