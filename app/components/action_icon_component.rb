# frozen_string_literal: true

# Renders a clickable icon (link or button) for toolbar actions.
# Replaces the Angular action_icon directive used in the core workspace.
#
# Use for Export, Delete, Share, etc. Pass a url for navigation, or omit for
# click-only actions (wire via data_action or parent Stimulus controller).
#
# @see docs/view_component_conventions.md
class ActionIconComponent < ApplicationComponent
  # @param icon_class [String] CSS classes for the icon (e.g. "bi bi-trash", "glyphicon glyphicon-trash")
  # @param title [String] Accessible title and tooltip
  # @param url [String, nil] Optional. If present, renders as a link (use relative URLs). If blank, renders as a button for Stimulus.
  # @param html_options [Hash] Optional. Merged into the link/button tag (e.g. data: { action: "click->workspace#openExport" })
  def initialize(icon_class:, title:, url: nil, **html_options)
    @icon_class   = icon_class
    @title        = title
    @url          = url.presence
    @html_options = html_options
  end

  def call
    if @url
      link_to @url, link_options do
        icon_tag
      end
    else
      # Use <a href="#"> so existing a.action-icon CSS applies; Stimulus prevents default.
      link_to '#', link_options do
        icon_tag
      end
    end
  end

  private

  def icon_tag
    content_tag :i, '', class: @icon_class, aria: { hidden: true }, title: @title
  end

  def link_options
    { class: 'action-icon' }.deep_merge(@html_options)
  end
end
