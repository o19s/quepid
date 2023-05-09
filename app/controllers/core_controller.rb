# frozen_string_literal: true

# This hosts the main Angular 1 application that runs in the client.
class CoreController < ApplicationController
  before_action :set_case_or_bootstrap
  before_action :populate_from_params

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

  
  def populate_from_params

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

    true
  end
end
