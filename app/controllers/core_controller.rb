# frozen_string_literal: true

# This hosts the main Angular 1 application that runs in the client.
class CoreController < ApplicationController
  before_action :set_case_or_bootstrap

  before_action :redirect_to_correct_tls # force a match to the URL of the search engine

  def index
    # return unless current_user
  end

  private

  def set_case_or_bootstrap
    @case = if params[:id].present?
              # load the explicitly listed case.
              current_user.cases_involved_with.where(id: params[:id]).first
            else
              # load a case/try if the user has access to one
              current_user.cases_involved_with.not_archived.last
            end

    if @case # don't run if we don't find the case!
      @try = if params[:try_number].present?
               @case.tries.where(try_number: params[:try_number]).first
             else
               @case.tries.latest
             end
    end
  end

  # If Quepid is running on HTTPS, like on Heroku, then it needs to switch
  # to HTTP in order to make calls to a Solr that is running in HTTP as well, otherwise
  # you get this "Mixed Content", which browsers block as a security issue.
  # https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content
  #
  # Similarily we may have only HTTPS set up for Quepid, and therefore need to stay on HTTPS,
  # so this method is only conditionally called if force_ssl is false.
  #
  # rubocop:disable Layout/LineLength
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def redirect_to_correct_tls
    return true if @case.blank? # shortcut if we don't have an @case.

    if @case.present? && params[:caseName]
      @case.case_name = params[:caseName]
      @case.save
    end

    if @try.present?
      # Deal with front end UI changes to search engine being stored in backend
      if params[:searchEngine].present?
        # Reset the default queries
        @try.search_engine = params[:searchEngine] if @try.search_engine != params[:searchEngine]
        @try.search_url = params[:searchUrl]
        @try.api_method = params[:apiMethod]
        @try.field_spec = params[:fieldSpec]
      end
      @try.save
    end

    search_engine_starts_with_https = @try.present? && @try.search_url.present? ? @try.search_url.starts_with?('https') : false

    if search_engine_starts_with_https && !request.ssl? # redirect to SSL
      original_url = request.original_url
      original_url.gsub!(%r{http://}, 'https://')
      redirect_to original_url
      false
    elsif !search_engine_starts_with_https && request.ssl? # redirect to Non SSL
      original_url = request.original_url
      original_url.gsub!(%r{https://}, 'http://')
      redirect_to original_url
      false
    else
      true
    end
  end
  # rubocop:enable Layout/LineLength
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
end
