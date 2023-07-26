# frozen_string_literal: true

class HomeController < ApplicationController
  def show
    @cases = @current_user.cases
  end
end
