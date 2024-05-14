# frozen_string_literal: true

module Authentication
  module CurrentCaseManager
    extend ActiveSupport::Concern

    included do
      helper_method :current_case
      helper_method :set_recent_cases
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

    def set_recent_cases
      @recent_cases = recent_cases(3)
    end

    # rubocop:disable Metrics/MethodLength
    def recent_cases count
      if current_user
        # Using joins/includes will not return the proper list in the
        # correct order because rails refuses to include the
        # `case_metadata`.`last_viewed_at` column in the SELECT statement
        # which will then cause the ordering not to work properly.
        # So instead, we have this beauty!
        sql = "
          SELECT  DISTINCT `cases`.`id`, `case_metadata`.`last_viewed_at`
          FROM `cases`
          LEFT OUTER JOIN `case_metadata` ON `case_metadata`.`case_id` = `cases`.`id`
          LEFT OUTER JOIN `teams_cases` ON `teams_cases`.`case_id` = `cases`.`id`
          LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_cases`.`team_id`
          LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
          LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
          WHERE (`teams_members`.`member_id` = #{current_user.id} OR `cases`.`owner_id` = #{current_user.id})
          AND (`cases`.`archived` = false OR `cases`.`archived` IS NULL)
          ORDER BY `case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC
          LIMIT #{count}
        "

        results = ActiveRecord::Base.connection.execute(sql)

        case_ids = results.map do |row|
          row.first.to_i
        end

        # map to objects
        # cases = Case.includes(:tries).where(id: [ case_ids ])
        cases = Case.where(id: [ case_ids ])
        cases = cases.sort_by { |x| case_ids.index x.id }
      else
        cases = []
      end
      cases
    end
    # rubocop:enable Metrics/MethodLength

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
