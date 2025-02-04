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
              end

      if @case.nil? # We didn't find a match, so let's see if it's a public case
        @case = Case.public_cases.find_by(id: case_id)
      end
    end

    def recent_cases count
      if current_user
        # case_ids = current_user.case_metadata.order(last_viewed_at: :desc).limit(count).pluck(:case_id)

        # map to objects
        # cases = current_user.cases_involved_with.where(id: case_ids).not_archived

        # the WHERE IN clause doesn't guarantee returning in order, so this sorts the cases in order of last viewing.
        # cases = cases.sort_by { |x| case_ids.index x.id }
        cases = current_user.cases_involved_with.not_archived.with_counts
          .includes([ :metadata ])
          .order('`case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC')
          .limit(count)
      else
        cases = []
      end
      cases
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
