# frozen_string_literal: true

class HomeController < ApplicationController
  # rubocop:disable Metrics/AbcSize
  def show
    # @cases = @current_user.cases.not_archived.includes([ :scores ])
    @cases = @current_user.cases.not_archived.recent.uniq

    # copied from dropdown_contoller.rb
    @most_recent_cases = lookup_most_recent_cases

    @most_recent_books = []
    @lookup_for_books = {}
    @current_user.books_involved_with.order(:updated_at).limit(4).each do |book|
      @most_recent_books << book
      judged_by_current_user = book.judgements.where(user: @current_user).count
      if judged_by_current_user.positive? && judged_by_current_user < book.query_doc_pairs.count
        @lookup_for_books[book] = book.query_doc_pairs.count - judged_by_current_user

      end
    end

    candidate_cases = @cases.select { |kase| kase.scores.scored.count.positive? }
    @grouped_cases = candidate_cases.group_by { |kase| kase.case_name.split(':').first }
    @grouped_cases = @grouped_cases.select { |_key, value| value.count > 1 }
  end
  # rubocop:enable Metrics/AbcSize

  private

  # rubocop:disable Metrics/MethodLength
  def lookup_most_recent_cases
    # Using joins/includes will not return the proper list in the
    # correct order because rails refuses to include the
    # `case_metadata`.`last_viewed_at` column in the SELECT statement
    # which will then cause the ordering not to work properly.
    # So instead, we have this beauty!
    sql = "
      SELECT DISTINCT `cases`.`id`, `case_metadata`.`last_viewed_at`
      FROM `cases`
      LEFT OUTER JOIN `case_metadata` ON `case_metadata`.`case_id` = `cases`.`id`
      LEFT OUTER JOIN `teams_cases` ON `teams_cases`.`case_id` = `cases`.`id`
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_cases`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
      WHERE (`teams_members`.`member_id` = #{current_user.id} OR `cases`.`owner_id` = #{current_user.id})
      AND (`cases`.`archived` = false OR `cases`.`archived` IS NULL)
      ORDER BY `case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC
      LIMIT 4
    "

    results = ActiveRecord::Base.connection.execute(sql)

    case_ids = []
    results.each do |row|
      case_ids << row.first.to_i
    end

    # map to objects
    # Don't include 'scores' until we solve the issue of some cases haveing 60,000+ records!
    most_recent_cases = Case.includes([ :scorer ]).where(id: [ case_ids ])
    most_recent_cases = most_recent_cases.select { |kase| kase.last_score.present? }

    # rubocop:enable
    most_recent_cases = most_recent_cases.sort_by(&:case_name)
    most_recent_cases
  end
  # rubocop:enable Metrics/MethodLength
end
