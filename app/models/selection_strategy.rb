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
  # 0 based positions fail the random function, so we add 1
  def self.random_query_doc_pair_for_single_judge book
    book.query_doc_pairs.includes(:judgements)
      .where(:judgements=>{ id: nil })
      .order(Arel.sql('-LOG(1.0 - RAND()) * (position + 1)'))
      .first
  end

  # Do we want to only require three judgements total?  or let more?
  def self.every_query_doc_pair_has_three_judgements_old? book
    already_has_three_judgements_query_doc_pair_ids = book.query_doc_pairs.joins(:judgements)
      .group('`query_doc_pairs`.`id`')
      .having('count(*) = ? ', 3)
      .pluck(:query_doc_pair_id)
    query_doc_pair = book.query_doc_pairs
      .where.not(id: already_has_three_judgements_query_doc_pair_ids ).first
    query_doc_pair.nil? # if we didn't find a match, then return true
  end

  def self.every_query_doc_pair_has_three_judgements? book
    query_doc_pair = book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) < 3')
      .first
    query_doc_pair.nil? # if we didn't find a match, then return true
  end

  # We are randomly with position bias picking query_doc_pairs, up to a limit of 3
  def self.random_query_doc_pair_for_multiple_judges book, user
    # wish this was one query ;-)
    already_judged_query_doc_pair_ids = book.judgements.where(user_id: user.id).pluck(:query_doc_pair_id)
    already_has_three_judgements_query_doc_pair_ids = book.query_doc_pairs.joins(:judgements)
      .group('`query_doc_pairs`.`id`')
      .having('count(*) = ? ', 3)
      .pluck(:query_doc_pair_id)

    ids_to_filter = (already_judged_query_doc_pair_ids + already_has_three_judgements_query_doc_pair_ids).flatten

    query_doc_pair = book.query_doc_pairs
      .where.not(id: ids_to_filter )
      .order(Arel.sql('-LOG(1.0 - RAND()) * (position + 1)'))
      .first

    query_doc_pair
  end

  def descriptive_name
    "#{name}: #{description}"
  end
end
