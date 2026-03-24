# frozen_string_literal: true

# This hosts the main Angular 1 application that runs in the client.
class CoreController < ApplicationController
  before_action :set_case_or_bootstrap, except: [ :new, :new_for_new_ui ]
  before_action :populate_from_params, except: [ :new, :new_for_new_ui, :new_ui ]
  before_action :load_shared_data, except: [ :new, :new_for_new_ui ]

  def index
    Analytics::Tracker.track_user_swapped_protocol current_user, @case, params['protocolToSwitchTo'] if params['protocolToSwitchTo']
  end

  def new_ui
    if @case.nil?
      render 'core/not_found', layout: 'core_new_ui', status: :not_found
      return
    end
    render layout: 'core_new_ui'
  end

  def new
    create_new_case!
    redirect_to case_core_path(@case, @case.tries.first.try_number, params: { showWizard: true })
  end

  def new_for_new_ui
    create_new_case!
    redirect_to case_core_new_ui_path(@case, @case.tries.first.try_number, showWizard: true)
  end

  private

  def create_new_case!
    @case = current_user.cases.build case_name: "Case #{current_user.cases.size}"
    @case.save!
  end

  def load_shared_data
    @recent_cases = recent_cases(4).includes(tries: :search_endpoint)
    @recent_cases_count = current_user.cases_involved_with.not_archived.count
    @recent_books = recent_books 4
    @recent_books_count = current_user.books_involved_with.count

    @queries = @case ? @case.queries.includes(:ratings).order(:arranged_at) : []
    @query_count = @queries.size
    @query_list_sortable = Rails.application.config.query_list_sortable
  end

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
        puts "Found search end point with id #{search_endpoint.id} and name #{search_endpoint.fullname}"
        @try.search_endpoint = search_endpoint
        @try.field_spec = params[:fieldSpec]
      end
      @try.save
    end
  end
end
