# frozen_string_literal: true

class HomeController < ApplicationController

  before_action :special_set_case_or_bootstrap

  before_action :redirect_to_correct_tls unless Rails.application.config.force_ssl

  def index
    #return unless current_user


  end

  private

  def special_set_case_or_bootstrap
    puts " I am in special_set_case_or_bootstrap"
    puts params


    # load a case/try if the user has access to one
    @case = current_user.cases_involved_with.not_archived.last

    if @case
      @try = @case.tries.latest
    end
  end

  # If Quepid is running on HTTPS, like on Heroku, then it needs to switch
  # to HTTP in order to make calls to a Solr that is running in HTTP as well, otherwise
  # you get this "Mixed Content", which browsers block as a security issue.
  # https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content
  #
  # Similarily we may have only HTTPS set up for Quepid, and therefore need to stay on HTTPS,
  # so this method is only conditionally called if force_ssl is false.

  # rubocop:disable Metrics/MethodLength
  def redirect_to_correct_tls

    puts params

    unless @case.present? # shortcut if we don't have an @case.
      return true
    end


    puts "About to look up tls settings for case #{@case.id}"
    search_engine_starts_with_https = @try.present? ? @try.search_url.starts_with?('https') : false

    puts "search_engine_starts_with_https: #{search_engine_starts_with_https}"
    if search_engine_starts_with_https && !request.ssl? # redirect to SSL
      original_url = request.original_url
      original_url.gsub!(%r{http://}, 'https://')
      flash[:success] = 'Redirecting to HTTPS Quepid page to match search engine URL.'
      redirect_to original_url
      flash.keep
      return false
    elsif !search_engine_starts_with_https && request.ssl? # redirect to Non SSL
      original_url = request.original_url
      original_url.gsub!(%r{https://}, 'http://')
      flash[:success] = 'Redirecting to HTTP Quepid page to match search engine URL.'
      redirect_to original_url
      flash.keep
      return false
    else
      return true
    end
  end
  # rubocop:enable Metrics/MethodLength
end
