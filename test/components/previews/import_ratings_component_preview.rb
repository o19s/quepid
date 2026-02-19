# frozen_string_literal: true

# Preview for ImportRatingsComponent. View at /rails/view_components in development.
class ImportRatingsComponentPreview < ViewComponent::Preview
  def icon_only
    render(ImportRatingsComponent.new(case_id: 1, case_name: 'Sample Case', icon_only: true))
  end

  def with_label
    render(ImportRatingsComponent.new(case_id: 1, case_name: 'Sample Case', icon_only: false))
  end
end
