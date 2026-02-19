# frozen_string_literal: true

# Preview for ExportCaseComponent. View at /rails/view_components in development.
class ExportCaseComponentPreview < ViewComponent::Preview
  def default
    render(
      ExportCaseComponent.new(
        case_id:                  1,
        case_name:                'Sample Case',
        icon_only:                true,
        supports_detailed_export: true
      )
    )
  end

  def with_text_link
    render(
      ExportCaseComponent.new(
        case_id:                  1,
        case_name:                'Another Case',
        icon_only:                false,
        supports_detailed_export: true
      )
    )
  end
end
