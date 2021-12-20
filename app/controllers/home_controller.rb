# frozen_string_literal: true

class HomeController < ApplicationController
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
  # The skip_changing_to_matching_tls lets us override this behavior, which we have to do when
  # you edit the search engine url in the front end.  We need to change first, then come back
  # and ask the person to reapply the change.

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def redirect_to_correct_tls

    puts "In redirect_to_correct_tls"


    bool = ActiveRecord::Type::Boolean.new
    #$skip_changing_to_matching_tls = bool.deserialize(params[:skip_changing_to_matching_tls]) || false

    #return true if true == skip_changing_to_matching_tls

    return true if @case.blank? # shortcut if we don't have an @case.

    puts "DO we have a try?  #{@try.present?}"
    puts "Alternatively, do we have a searchUrl? #{params[:searchUrl]}"
    puts params

    if @try.present? && params[:searchUrl]
      @try.search_url = params[:searchUrl]
      @try.save
    end

    search_engine_starts_with_https = @try.present? ? @try.search_url.starts_with?('https') : false

    if search_engine_starts_with_https && !request.ssl? # redirect to SSL
      original_url = request.original_url
      original_url.gsub!(%r{http://}, 'https://')
      flash[:success] = 'Reloaded on HTTPS protocol for Quepid app to match search engine URL.'
      redirect_to original_url
      flash.keep
      false
    elsif !search_engine_starts_with_https && request.ssl? # redirect to Non SSL
      original_url = request.original_url
      original_url.gsub!(%r{https://}, 'http://')
      flash[:success] = 'Reloaded on HTTP protocol for Quepid app to match search engine URL.'
      redirect_to original_url
      flash.keep
      false
    else
      true
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
end
