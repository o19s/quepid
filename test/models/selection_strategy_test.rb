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
require 'test_helper'

class SelectionStrategyTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end

  def times_drawn name, book
    counter = 0
    100.times { counter += 1 if SelectionStrategy.random_query_doc_pair_for_single_judge(book).doc_id == name }
    counter
  end

  describe 'single rater per query doc pair strategy' do
    describe 'return a weighted random based on position' do
      let(:book) { books(:james_bond_movies) }

      before do
        book.query_doc_pairs.each { |query_doc_pair| query_doc_pair.judgements.delete_all }
        assert_empty book.judgements
      end

      # test "we weight linearly the position, with 1 being higher then 6" do

      # 100.times do
      #  query_doc_pair = SelectionStrategy.random_query_doc_pair_for_single_judge(book)
      #  puts "Position: #{query_doc_pair.position}"
      # end

      # end

      it 'draws Sean Connery with weight 90% of overall within 50 of 500 times (5%   of 50%)' do
        # it would be nice to do a
        sean_connery_picks = times_drawn('SeanConnery', book)
        timothy_dalton_picks = times_drawn('TimothyDalton', book)
        george_lazenby_picks = times_drawn('GeorgeLazenby', book)

        assert_operator sean_connery_picks, :>, timothy_dalton_picks
        assert_operator timothy_dalton_picks, :>, george_lazenby_picks
      end
    end
  end

  describe 'mulitiple raters per query doc pair strategy' do
  end
end
