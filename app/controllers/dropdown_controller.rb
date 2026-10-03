# frozen_string_literal: true

class DropdownController < ApplicationController
  # Rails-page navbar: break out of the lazy-loaded Turbo Frame into a full-page Turbo visit.
  RAILS_PAGE_LINK_OPTIONS = { data: { turbo_frame: '_top' } }.freeze

  # Core case page navbar: these links need a real hard navigation - two independent
  # interceptors have to be defeated, not just one:
  #
  # 1. `turbo: false` instead of `turbo_frame: "_top"`: the frame is nested inside the
  #    client-bootstrapped core page, and Turbo Frames stay navigable even with Drive off (see
  #    DEVELOPER_GUIDE.md's "Turbo on the core case page"), so a "_top" visit would still swap
  #    the body via AJAX without reloading the script context.
  # 2. `target: "_self"`: ensures the link escapes the containing Turbo Frame and replaces the
  #    document rather than only updating the frame.
  #
  # Skipping either one leaves the URL changing while the page silently keeps showing the old
  # case. `class: "dropdown-item"` matches the core navbar's markup; without it the items render
  # as plain underlined text instead of full-row, padded/hoverable Bootstrap menu items.
  CORE_LINK_OPTIONS = { class: 'dropdown-item', data: { turbo: false }, target: '_self' }.freeze

  def cases
    render_cases RAILS_PAGE_LINK_OPTIONS
  end

  def books
    render_books RAILS_PAGE_LINK_OPTIONS
  end

  def cases_core
    render_cases CORE_LINK_OPTIONS
  end

  def books_core
    render_books CORE_LINK_OPTIONS
  end

  private

  def render_cases link_options
    @cases = recent_cases 4
    @link_options = link_options.deep_dup # link_to_core_case mutates options[:data]
    render :cases, layout: false
  end

  def render_books link_options
    @books = recent_books 4
    @link_options = link_options
    render :books, layout: false
  end
end
