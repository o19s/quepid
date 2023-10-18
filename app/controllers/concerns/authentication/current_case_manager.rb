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

    # Fetches case that a user can view and query.
    # This includes a case owned by the user, shared with an team owned by
    # the user, or shared with a team shared with the user.   Or even a
    # public case!
    def set_case
      case_id = params[:case_id]
      is_encrypted_case_id = !Float(case_id, exception: false)

      @case = if is_encrypted_case_id
                Case.public_cases.find_by(id: decrypt_case_id(case_id))
              elsif current_user
                current_user.cases_involved_with.where(id: case_id).first
              else
                Case.public_cases.find_by(id: case_id)
              end
    end

    def find_case
      # call set case instead
      set_case
    end

    def case_with_all_the_bells_whistles
      if current_user
        @case = current_user
          .cases_involved_with
          .where(id: params[:case_id])
          .includes(:tries )
          .preload([ queries: [ :ratings ], tries: [ :curator_variables, :search_endpoint ] ])
          .order('tries.try_number DESC')
          .first
      end
      @case = Case.public_cases.find_by(id: params[:case_id]) if @case.nil?
    end

    def check_case
      render json: { message: 'Case not found!' }, status: :not_found unless @case
    end

    def decrypt_case_id encrypted_value
      Rails.application.message_verifier('magic').verify(encrypted_value)
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      nil
    end
  end
end
