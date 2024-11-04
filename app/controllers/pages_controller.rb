# frozen_string_literal: true

class PagesController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [ :theme_textmate, :mode_json ]
  skip_before_action :check_for_announcement
  # before_action :check_page, only: [:show]

  # def show
  # render template: "pages/#{params[:page]}"
  # end
  
  # This is how we handle AngularJS wanting to load assets without us moving them on disk.
  def angularjs
    puts "hi"
    puts params
    
    path = request.path
    # Get the full request path (with query parameters, if any)
    full_path = request.fullpath

    # For demonstration, you can log or use the path
    puts "Request path: #{path}"
    puts "Full request path: #{full_path}"
    
    #full_path = "/angularjs/new_case/new_case.html"
    relative_path = "/" + params[:path] + ".html" #full_path.sub(/^\/angularjs\/?/, '')
    path_components = relative_path.split('/')
    
    #file_path = Rails.root.join('app', 'assets', 'javascripts','components','new_case','new_case.html') # adjust the path accordingly
    file_path_loc_a = Rails.root.join('app', 'assets', 'javascripts', 'components', *path_components)
    file_path_loc_b = Rails.root.join('app', 'assets', 'templates', *path_components)

    file_path = File.exist?(file_path_loc_a) ? file_path_loc_a : file_path_loc_b

    if File.exist?(file_path)
      render html: File.read(file_path).html_safe
    else
      render plain: "File not found", status: :not_found
    end
  end

  # this is how we deal with the ACE editor wanting this specific file.
  def theme_textmate
    path = 'node_modules/ace-builds/src-min-noconflict/theme-textmate.js'
    file_contents = File.read(path)
    render js: file_contents, content_type: Mime::Type.lookup('application/javascript')
  end

  # In production this route kicks in, and in dev we load /assets/mode-json.js from
  # the /app/assets/javascripts/mode-json.js location..
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
