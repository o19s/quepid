# frozen_string_literal: true

# Preview for ExpandContentComponent. View at /rails/view_components in development.
class ExpandContentComponentPreview < ViewComponent::Preview
  def default
    render(ExpandContentComponent.new(
      id: "expandContentPreview",
      title: "Relevancy Score: 2.34",
      body: "1.0 = (MATCH) weight(foo:bar in 0-10) [DefaultSimilarity]\n0.5 = (MATCH) fieldNorm(field=content)"
    ))
  end
end
