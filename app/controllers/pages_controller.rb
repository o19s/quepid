# frozen_string_literal: true

class PagesController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [ :theme_textmate ]
  # before_action :check_page, only: [:show]

  # def show
  # render template: "pages/#{params[:page]}"
  # end

  # this is how we deal with the ACE editor wanting this specific file.
  # There is another mode-json.js file that it wants from /assets/mode-json.js,
  # and that we are able to just add to /app/assets/javascripts.
  def theme_textmate
    path = 'node_modules/ace-builds/src-min-noconflict/theme-textmate.js'
    file_contents = File.read(path)
    render js: file_contents, content_type: Mime::Type.lookup('application/javascript')
  end
  
  def mode_json
    path = 'node_modules/ace-builds/src-min-noconflict/mode-json.js'
    file_contents = File.read(path)
    render js: file_contents, content_type: Mime::Type.lookup('application/javascript')
  end

  private

  def check_page
    path    = "app/views/pages/#{params[:page]}.html.erb"
    exists  = File.exist?(Pathname.new(Rails.root + path))

    render file: 'public/404.html', status: :not_found unless exists
  end
end
