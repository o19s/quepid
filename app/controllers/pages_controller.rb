# frozen_string_literal: true

class PagesController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [:worker_javascript, :worker_json ]
  skip_before_action :check_for_announcement
  # before_action :check_page, only: [:show]

  # def show
  # render template: "pages/#{params[:page]}"
  # end
  
  # ace wants to always load the workers from the root "/" end point.  So /worker-javascript.js and /worker-json.s
  # It defines it's own full path, so we can't override it with one from importmaps
  def worker_javascript
    path = 'node_modules/ace-builds/src-min-noconflict/worker-javascript.js'
    file_contents = File.read(path)
    render js: file_contents, content_type: Mime::Type.lookup('application/javascript')
  end
  
  def worker_json
    path = 'node_modules/ace-builds/src-min-noconflict/worker-json.js'
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
