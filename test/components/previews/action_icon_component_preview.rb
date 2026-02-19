# frozen_string_literal: true

# Preview for ActionIconComponent. View at /rails/view_components in development.
# See docs/view_component_conventions.md for preview conventions.
class ActionIconComponentPreview < ViewComponent::Preview
  def default
    render(ActionIconComponent.new(
             icon_class: 'bi bi-file-earmark-arrow-up',
             title:      'Export'
           ))
  end

  def as_link
    render(ActionIconComponent.new(
             icon_class: 'bi bi-file-earmark-arrow-up',
             title:      'Export',
             url:        '#'
           ))
  end

  def share_icon
    render(ActionIconComponent.new(icon_class: 'bi bi-share', title: 'Share Case'))
  end
end
