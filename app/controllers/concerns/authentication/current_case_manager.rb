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
      # current_case_metadatum
    end

    def current_case_metadatum
      @case_metadatum = @case.metadata.find_or_create_by user_id: current_user.id unless @case.nil?
    end

    # Fetches case that a user can view and query.
    # This includes a case owned by the user, shared with an team owned by
    # the user, or shared with a team shared with the user.
    # possibility that set_case and find_case could be merged.
    def find_case
      @case = current_user.cases_involved_with.where(id: params[:case_id]).first
      # current_case_metadatum
    end

    def case_with_all_the_bells_whistles
      # The joins to include all the cases this user has access to was appearing to make a GIANT query
      # that would time out on MySQL.
      cases_involved_with_ids = current_user.cases_involved_with.pluck(:id)
      puts "cases_involved_with_ids #{cases_involved_with_ids}"
      puts "params[:case_id]: #{params[:case_id]}"
      puts "cases_involved_with_ids include? #{cases_involved_with_ids.include?( params[:case_id].to_i )}"
      case_id_int = params[:case_id].to_i

      if (cases_involved_with_ids.include?( case_id_int ))
        @case = Case.where(id: case_id_int)
          .includes([ queries: [ :ratings, :test, :scorer ], tries: [ :curator_variables ] ])
          .order('tries.try_number DESC').first
      end

    end

    def check_case
      current_case_metadatum
      render json: { message: 'Case not found!' }, status: :not_found unless @case
    end
  end
end
