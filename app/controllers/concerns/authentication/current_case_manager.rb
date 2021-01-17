# frozen_string_literal: true

module Authentication
  module CurrentCaseManager
    extend ActiveSupport::Concern

    included do
      helper_method :current_case
    end

    private

    def current_case
      @case
    end

    def set_case
      @case = current_user.cases.where(id: params[:case_id]).first
    end

    # Fetches case that a user can view and query.
    # This includes a case owned by the user, shared with an team owned by
    # the user, or shared with a team shared with the user.
    def find_case
      @case = current_user.cases_involved_with.where(id: params[:case_id]).first
    end

    def case_with_all_the_bells_whistles
      @case = current_user
        .cases_involved_with
        .where(id: params[:case_id])
        .includes([ queries: [ :ratings, :test, :scorer ], tries: [ :curator_variables ] ])
        .order('tries.try_number DESC')
        .first
    end

    def check_case
      render json: { message: 'Case not found!' }, status: :not_found unless @case
    end
  end
end
