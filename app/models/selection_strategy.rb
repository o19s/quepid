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
  def self.random_query_doc_based_on_strategy book
    case book.selection_strategy.name
    when 'Single Rater'
      random_query_doc_pair_for_single_judge(book)
    when 'Multiple Raters'
      random_query_doc_pair_for_multiple_judges(book)
    else
      raise "#{book.selection_strategy.name} is unknown!"
    end
  end

  # Randomly select a query doc where we don't have any judgements, and weight it by the position,
  # so that position of 1 should be returned more often than a position of 5 or 10.
  def self.random_query_doc_pair_for_single_judge book
    # book.query_doc_pairs.includes(:judgements).where(:judgements=>{id:nil}).order(Arel.sql('RAND()')).first
    book.query_doc_pairs.includes(:judgements)
      .where(:judgements=>{ id: nil })
      .order(Arel.sql('-LOG(1.0 - RAND()) * position'))
      .first
  end

  # First go wide by getting a rating for every query, then start going deeper by
  # randomly selecting a query doc where we have less than or equal to three judgements, and weight it by the position,
  # so that position of 1 should be returned more often than a position of 5 or 10.
  def self.random_query_doc_pair_for_multiple_judges book
    query_doc_pair = random_query_doc_pair_for_single_judge(book)
    if query_doc_pair.nil?
      query_doc_pair = book.query_doc_pairs.joins(:judgements)
        .group(:query_doc_pair_id)
        .having('count(*) < ? ', 3)
        .order(Arel.sql('-LOG(1.0 - RAND()) * position'))
        .first
    end
    query_doc_pair
  end

  def descriptive_name
    "#{name}: #{description}"
  end
end
