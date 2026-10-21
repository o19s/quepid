# frozen_string_literal: true

# This hosts the main case application that runs in the client.
class CoreController < ApplicationController
  NO_CASES_MESSAGE = "You don't have any Cases created in Quepid. Click 'Create a Case' from the Relevancy Cases dropdown to get started."

  layout 'application'
  before_action :set_case_or_bootstrap, except: :new
  before_action :populate_from_params, except: :new

  def index
    # The initial workspace data includes user-scoped endpoint credentials.
    response.cache_control.replace(private: true, no_store: true)
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
              current_user.cases_involved_with.find_by(id: params[:id])
            else
              # load a case/try if the user has access to one
              current_user.cases_involved_with.not_archived.last
            end

    unless @case
      # An explicit id that doesn't resolve is a 404; GET must never create a case as a side effect.
      # The page keeps Legacy's hint that the case may not be shared with the user.
      if params[:id].present?
        raise ActiveRecord::RecordNotFound.new('Case not found', 'Case', 'id', params[:id]) unless request.format.html?

        return render(:case_not_found, status: :not_found)
      end

      return redirect_to(cases_path, alert: NO_CASES_MESSAGE)
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

        # The wizard's protocol-switch reload passes a mapper-based preset's id (e.g. 'vespa')
        # so it can restore that tile; store it as the preset's real engine and mapper.
        requested_engine = params[:searchEngine]
        preset = MapperBasedSearchEngine.find(requested_engine)
        search_endpoint_params = {
          search_engine:         preset&.search_engine || requested_engine,
          endpoint_url:          params[:searchUrl],
          api_method:            params[:apiMethod],
          basic_auth_credential: params[:basicAuthCredential],

        }
        search_endpoint_params[:mapper_based_search_engine_id] = preset.id if preset
        search_endpoint = SearchEndpoint.create_with(mapper_code: preset&.mapper_code)
          .find_or_create_by search_endpoint_params
        # An endpoint that fails validation (e.g. the instance requires proxying, which this
        # URL can't carry) would otherwise be saved onto the try as no endpoint at all.
        @try.search_endpoint = search_endpoint if search_endpoint.persisted?
        @try.field_spec = params[:fieldSpec]
      end
      @try.save
    end
  end
end
