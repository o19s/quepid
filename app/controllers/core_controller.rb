# frozen_string_literal: true

# This hosts the main case application that runs in the client.
class CoreController < ApplicationController
  layout 'application'
  before_action :set_case_or_bootstrap, except: :new
  before_action :populate_from_params, except: :new

  def index
    Analytics::Tracker.track_user_swapped_protocol current_user, @case, params['protocolToSwitchTo'] if params['protocolToSwitchTo']
  end

  def new
    @case = current_user.cases.build case_name: "Case #{current_user.cases.size}"
    @case.save!

    redirect_to case_core_path(@case, @case.tries.first.try_number, params: { showWizard: true })
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

    unless @case
      # An explicit id that doesn't resolve is a 404; GET must never create a case as a side effect.
      raise ActiveRecord::RecordNotFound.new('Case not found', 'Case', 'id', params[:id]) if params[:id].present?

      return redirect_to(case_new_path)
    end

    @try = if params[:try_number].present?
             @case.tries.where(try_number: params[:try_number]).first
           else
             @case.tries.latest
           end
  end

  def populate_from_params
    if @case.present? && params[:caseName]
      @case.case_name = params[:caseName]
      @case.save
    end

    if @try.present?
      # Deal with front end UI changes to search engine being stored in backend
      if params[:searchEngine].present?

        search_endpoint_params = {
          search_engine:         params[:searchEngine],
          endpoint_url:          params[:searchUrl],
          api_method:            params[:apiMethod],
          basic_auth_credential: params[:basicAuthCredential],

        }
        search_endpoint = SearchEndpoint.find_or_create_by search_endpoint_params
        @try.search_endpoint = search_endpoint
        @try.field_spec = params[:fieldSpec]
      end
      @try.save
    end
  end
end
