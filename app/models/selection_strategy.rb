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

  # Because of the way the logic looks up existing judgements, if you a judgement
  # that is either unrateable or judge_later, then it won't be selected.
  def self.moar_judgements_needed? book
    case book.selection_strategy.name
    when 'Single Rater'
      !every_query_doc_pair_has_a_judgement? book
    when 'Multiple Raters'
      !every_query_doc_pair_has_three_judgements? book
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
  def self.every_query_doc_pair_has_three_judgements? book
    query_doc_pair = book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) < 3')
      .first
    query_doc_pair.nil? # if we didn't find a match, then return true
  end

  def self.every_query_doc_pair_has_a_judgement? book
    query_doc_pair = book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) < 1')
      .first
    query_doc_pair.nil? # if we didn't find a match, then return true
  end

  # We are randomly with position bias picking query_doc_pairs, up to a limit of 3
  def self.random_query_doc_pair_for_multiple_judges book, user
    query_doc_pair = book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(CASE WHEN judgements.user_id = ? THEN 1 END) = 0', user.id)
      .having('COUNT(judgements.id) < 3')
      .order(Arel.sql('-LOG(1.0 - RAND()) * (position + 1)'))
      .first

    query_doc_pair
  end

  def descriptive_name
    "#{name}: #{description}"
  end
end
