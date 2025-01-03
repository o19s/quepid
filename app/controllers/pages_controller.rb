# frozen_string_literal: true

class PagesController < ApplicationController
  skip_before_action :require_login
  before_action :check_page, only: [ :show ]

  def show
    render template: "pages/#{params[:page]}"
  end

  private

  def check_page
    path    = "app/views/pages/#{params[:page]}.html.erb"
    exists  = File.exist?(Pathname.new(Rails.root + path))

    render file: 'public/404.html', status: :not_found unless exists
  end
end
