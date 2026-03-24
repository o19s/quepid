# frozen_string_literal: true

class DropdownController < ApplicationController
  def cases
    @cases = recent_cases 4
    @use_new_ui = deserialize_bool_param(params[:new_ui])
    render layout: false
  end

  def books
    @books = recent_books 4
    render layout: false
  end
end
