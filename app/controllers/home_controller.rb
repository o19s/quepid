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

    # load a case/try if the user has access to one
    @bootstrap_case = current_user.cases_involved_with.not_archived.last

    if @bootstrap_case
      @bootstrap_case_no = @bootstrap_case.id
      @latest_try = @bootstrap_case.tries.latest
      @bootstrap_try_no = @latest_try.try_number if @latest_try.present?
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
    search_engine_starts_with_https = false
    #bootstrap_case = current_user.cases_involved_with.not_archived.last

    puts params

      
    puts "About to look up tls settings for case #{@bootstrap_case.id}"
    bootstrap_case = @bootstrap_case

    if bootstrap_case
      if @bootstrap_try.present?
        try = @bootstrap_try
      else
        try = bootstrap_case.tries.latest
      end
      search_engine_starts_with_https = try.search_url.starts_with?('https') if try.present?
    end
    puts "search_engine_starts_with_https: #{search_engine_starts_with_https}"
    if search_engine_starts_with_https && !request.ssl? # redirect to SSL
      original_url = request.original_url
      original_url.gsub!(%r{http://}, 'https://')
      redirect_to original_url
      flash.keep
      false
    elsif !search_engine_starts_with_https && request.ssl? # redirect to Non SSL
      original_url = request.original_url
      original_url.gsub!(%r{https://}, 'http://')
      redirect_to original_url
      flash.keep
      false
    else
      true
    end
  end
  # rubocop:enable Metrics/MethodLength
end
