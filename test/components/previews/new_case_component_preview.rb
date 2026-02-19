# frozen_string_literal: true

# Preview for NewCaseComponent. View at /rails/view_components in development.
class NewCaseComponentPreview < ViewComponent::Preview
  def default
    render(NewCaseComponent.new(button_text: 'Create a case'))
  end

  def block_style
    render(NewCaseComponent.new(button_text: 'Create a case', block_style: true))
  end

  def as_dropdown_item
    render(NewCaseComponent.new(button_text: 'Create case...', button_class: 'dropdown-item'))
  end
end
