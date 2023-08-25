# frozen_string_literal: true

class HomeController < ApplicationController
  # rubocop:disable Metrics/AbcSize
  def show
    # @cases = @current_user.cases.not_archived.includes([ :scores ])
    @cases = @current_user.cases.not_archived.recent.uniq

    @most_recent_cases = @cases[0...4].sort_by(&:case_name)

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
end
