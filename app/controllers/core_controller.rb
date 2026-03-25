# frozen_string_literal: true

class CoreController < ApplicationController
  before_action :set_case_or_bootstrap, except: [ :new ]
  before_action :load_shared_data, except: [ :new ]

  def index
    render 'core/not_found', status: :not_found if @case.nil?
  end

  def new
    create_new_case!
    redirect_to case_core_path(@case, @case.tries.first.try_number, showWizard: true)
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
end
