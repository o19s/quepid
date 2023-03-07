# frozen_string_literal: true

# == Schema Information
#
# Table name: selection_strategies
#
#  id         :bigint           not null, primary key
#  name       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
class SelectionStrategy < ApplicationRecord

  # Randomly select a query doc where we don't have any judgements, and weight it by the position,
  # so that position of 1 should be returned more often than a position of 5 or 10.
  def self.random_query_doc_pair_for_single_judge book
    # book.query_doc_pairs.includes(:judgements).where(:judgements=>{id:nil}).order(Arel.sql('RAND()')).first
    book.query_doc_pairs.includes(:judgements).where(:judgements=>{ id: nil }).order(Arel.sql('-LOG(1.0 - RAND()) * position')).first
  end
end
