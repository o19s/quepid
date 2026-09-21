# frozen_string_literal: true

class DropdownController < ApplicationController
  def cases
    @cases = recent_cases 4
    render layout: false
  end

  def books
    @books = recent_books 4
    render layout: false
  end

  # Core case page twin of #cases - same list, but cases_core.html.erb links with
  # `turbo: false` instead of `turbo_frame: "_top"` so a click is a real browser
  # navigation. See config/routes.rb for why.
  def cases_core
    @cases = recent_cases 4
    render layout: false
  end

  # Core case page twin of #books - see #cases_core.
  def books_core
    @books = recent_books 4
    render layout: false
  end
end
