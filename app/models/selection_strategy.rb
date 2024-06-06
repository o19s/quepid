# frozen_string_literal: true

# == Schema Information
#
# Table name: selection_strategies
#
#  id          :bigint           not null, primary key
#  description :string(255)
#  name        :string(255)
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
class SelectionStrategy < ApplicationRecord
  def single_rater?
    'Single Rater' == name
  end

  # Because of the way the logic looks up existing judgements, if you a judgement
  # that is either unrateable or judge_later, then it won't be selected.
  def self.random_query_doc_based_on_strategy book, user
    case book.selection_strategy.name
    when 'Single Rater'
      random_query_doc_pair_for_single_judge(book)
    when 'Multiple Raters'
      random_query_doc_pair_for_multiple_judges(book, user)
    else
      raise "#{book.selection_strategy.name} is unknown!"
    end
  end

  # Randomly select a query doc where we don't have any judgements, and weight it by the position,
  # so that position of 1 should be returned more often than a position of 5 or 10.
  def self.random_query_doc_pair_for_single_judge book
    book.query_doc_pairs.includes(:judgements)
      .where(:judgements=>{ id: nil })
      .order(Arel.sql('-LOG(1.0 - RAND()) * position'))
      .first
  end

  # First go wide by getting a rating for every query, then start going deeper by
  # Struggled to get this to work, so now I don't think we have a good depth limit

  def self.random_query_doc_pair_for_multiple_judges book, user
    query_doc_pair = random_query_doc_pair_for_single_judge(book)
    if query_doc_pair.nil?
      # query_doc_pair = book.query_doc_pairs.joins(:judgements)
      #  .where.not(:judgements => { user_id: user.id })
      #  .group(:query_doc_pair_id)
      #  .having('count(*) < ? ', 3)
      ##  .first

      # wish this was one query ;-)
      already_judged_query_doc_pair_ids = book.judgements.where(user_id: user.id).pluck(:query_doc_pair_id)

      query_doc_pair = book.query_doc_pairs
        .where.not(id: already_judged_query_doc_pair_ids )
        .joins(:judgements)
        .order(Arel.sql('-LOG(1.0 - RAND()) * position'))
        .first

    end
    query_doc_pair
  end

  def descriptive_name
    "#{name}: #{description}"
  end
end
