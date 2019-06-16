# frozen_string_literal: true

module Api
  module V1
    module Cases
      class DropdownController < Api::ApiController
        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/LineLength
        def index
          # Using joins/includes will not return the proper list in the
          # correct order because rails refuses to include the
          # `case_metadata`.`last_viewed_at` column in the SELECT statement
          # which will then cause the ordering not to work properly.
          # So instead, we have this beauty!
          cases_ids = Case.find_by_sql([ "
            SELECT  DISTINCT `cases`.`id`, `case_metadata`.`last_viewed_at`
            FROM `cases`
            LEFT OUTER JOIN `case_metadata` ON `case_metadata`.`case_id` = `cases`.`id`
            LEFT OUTER JOIN `teams_cases` ON `teams_cases`.`case_id` = `cases`.`id`
            LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_cases`.`team_id`
            LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
            LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
            WHERE (`teams`.`owner_id` = :user_id OR `teams_members`.`member_id` = :user_id OR `cases`.`user_id` = :user_id)
            AND (`cases`.`archived` = false OR `cases`.`archived` IS NULL)
            ORDER BY `case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC
            LIMIT 3
          ", { user_id: current_user.id } ])

          @cases = current_user.case
          @cases = @cases.where(id: cases_ids.map(&:id))
          @cases = @cases.not_archived
          @cases = @cases.merge(Metadatum.order(last_viewed_at: :desc))
          @cases = @cases.order(id: :desc)
          @cases = @cases.limit(3)
          @cases = @cases.all

          respond_with @cases
        end
        # rubocop:enable Metrics/LineLength
        # rubocop:enable Metrics/MethodLength
      end
    end
  end
end
