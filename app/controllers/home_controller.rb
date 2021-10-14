# frozen_string_literal: true

class HomeController < ApplicationController
  # If Quepid is running on HTTPS, like on Heroku, then it needs to switch
  # to HTTP in order to make calls to a Solr that is running in HTTP as well, otherwise
  # you get this "Mixed Content", which browsers block as a security issue.
  # https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content
  before_action :redirect_to_non_ssl

  def index
    return unless current_user

    puts "What is the request?  #{request.ssl?}"

    # load a case/try if the user has access to one
    bootstrap_case = current_user.cases_involved_with.not_archived.last

    if bootstrap_case
      @bootstrap_case_no = bootstrap_case.id
      latest_try = bootstrap_case.tries.latest
      @bootstrap_try_no = latest_try.try_number if latest_try.present?
    end
  end

  private

  def redirect_to_non_ssl
    puts "I AM IN REDIRECT TO NON SSL"

    search_engine_starts_with_https = false
    bootstrap_case = current_user.cases_involved_with.not_archived.last

    puts "bootstrap case:#{bootstrap_case}"

    if bootstrap_case

      latest_try = bootstrap_case.tries.latest
      puts "latest_try: #{latest_try}"
      if latest_try
        puts "Here is search url: #{latest_try.search_url}"
        search_engine_starts_with_https = latest_try.search_url.starts_with?("https")
        puts "search_engine_starts_with_https is #{search_engine_starts_with_https}"
      end
    end

    puts "search_engine_starts_with_https: #{search_engine_starts_with_https}"
    puts "request.ssl? #{request.ssl?}"
    if search_engine_starts_with_https and !request.ssl?  # redirect to SSL
      puts "Redirecting to SSL"
      original_url = request.original_url
      original_url.gsub!(%r{http://}, 'https://')
      redirect_to original_url
      flash.keep
      return false
    elsif !search_engine_starts_with_https and request.ssl? #redirect to Non SSL
      puts "Redirecting to non SSL"
      original_url = request.original_url
      original_url.gsub!(%r{https://}, 'http://')
      redirect_to original_url
      flash.keep
      return false
    else
      puts "No need to redirect"
      return true
    end
  end
end
