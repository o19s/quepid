# frozen_string_literal: true

# Hosts the case workspace (Stimulus/Turbo layout).
class CoreController < ApplicationController
  before_action :set_case_or_bootstrap, except: :new
  before_action :populate_from_params, except: :new

  # Visiting /case (no id): redirect to the case workspace if the user has a case,
  # otherwise to the cases list.
  def index
    Analytics::Tracker.track_user_swapped_protocol current_user, @case, params['protocolToSwitchTo'] if params['protocolToSwitchTo']

    if @case.present?
      try_number = @case.tries.first&.try_number
      redirect_to case_core_path(@case, try_number)
    else
      redirect_to cases_path
    end
  end

  # Renders the case/try workspace with the modern layout (Stimulus/Turbo).
  # Case and try context are set by set_case_or_bootstrap and available as @case, @try.
  def show
    return redirect_to cases_path if @case.blank?

    render layout: 'core_modern'
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

    if @case # don't run if we don't find the case!
      @try = if params[:try_number].present?
               @case.tries.where(try_number: params[:try_number]).first
             else
               @case.tries.latest
             end
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
        Rails.logger.debug { "Found search end point with id #{search_endpoint.id} and name #{search_endpoint.fullname}" }
        @try.search_endpoint = search_endpoint
        @try.field_spec = params[:fieldSpec]
      end
      @try.save
    end
  end
end
