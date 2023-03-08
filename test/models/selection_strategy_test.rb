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
require 'test_helper'

class SelectionStrategyTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end

  def times_drawn name, book
    counter = 0
    250.times { counter += 1 if SelectionStrategy.random_query_doc_pair_for_single_judge(book).doc_id == name }
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

      it 'draws Sean Connery way more then George Lazenby due to postion in results' do
        # there can be false positive failures due to the RAND() in mysql...
        sean_connery_picks = times_drawn('SeanConnery', book)
        george_lazenby_picks = times_drawn('GeorgeLazenby', book)

        assert_operator sean_connery_picks, :>, george_lazenby_picks
      end
    end
  end

  describe 'mulitiple raters per query doc pair strategy' do
    describe 'we rate wide each query' do
      let(:book) { books(:james_bond_movies) }
      let(:selection_strategy) { selection_strategies(:multiple_raters) }

      before do
        book.query_doc_pairs.each { |query_doc_pair| query_doc_pair.judgements.delete_all }
        assert_empty book.judgements
        book.selection_strategy = selection_strategy
        book.save!
      end

      it 'should rate wide' do
        book.query_doc_pairs.size.times do
          query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book)
          assert_empty query_doc_pair.judgements
          query_doc_pair.judgements.create rating: 2.0
        end
        book.reload
        # We have rated wide, so everyone has one.
        book.query_doc_pairs.each { |qdp| assert_equal 1, qdp.judgements.size }

        (book.query_doc_pairs.size * 2).times do
          query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book)
          query_doc_pair.judgements.create rating: 3.0
        end
        book.reload
        # We have rated deep, so should have 3 judgements for each one
        book.query_doc_pairs.each { |qdp| assert_equal 3, qdp.judgements.size }

        # No moar to be rated
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book)
      end
    end
  end
end
