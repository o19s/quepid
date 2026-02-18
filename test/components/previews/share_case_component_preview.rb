# frozen_string_literal: true

# Preview for ShareCaseComponent. View at /rails/view_components in development.
# Requires share-case modal in DOM for open to work (e.g. cases index or core show).
class ShareCaseComponentPreview < ViewComponent::Preview
  def icon_only
    render(ShareCaseComponent.new(
      case_id: 1,
      case_name: "Sample Case",
      all_teams: [{ id: 1, name: "Team A" }, { id: 2, name: "Team B" }],
      shared_teams: [{ id: 1, name: "Team A" }],
      icon_only: true
    ))
  end

  def with_label
    render(ShareCaseComponent.new(
      case_id: 1,
      case_name: "Sample Case",
      all_teams: [{ id: 1, name: "Team A" }],
      shared_teams: [],
      icon_only: false
    ))
  end
end
