# frozen_string_literal: true

require 'test_helper'

class JudgementMergerTest < ActiveSupport::TestCase
  cover 'JudgementMerger*'

  let(:explicit_book) { Book.new(scale: [ 0, 1, 2, 3 ]) }
  let(:implicit_book) { Book.new(scale: [ 0, 1, 2, 3 ], support_implicit_judgements: true) }

  def judgements *ratings
    ratings.map { |rating| Judgement.new(rating: rating) }
  end

  def merge book, *ratings
    JudgementMerger.new(book).rating_for(judgements(*ratings))
  end

  describe 'quepid_classic' do
    it 'returns the single rating when only one judgement exists' do
      assert_equal 2, merge(implicit_book, 2.0)
    end

    it 'returns the rating when two judges agree' do
      assert_equal 3, merge(implicit_book, 3.0, 3.0)
    end

    it 'returns the average when two judges disagree' do
      assert_in_delta 2.5, merge(implicit_book, 4.0, 1.0)
      assert_in_delta 1.5, merge(implicit_book, 3.0, 0.0)
    end

    it 'returns the rating when three judges agree' do
      assert_equal 2, merge(implicit_book, 2.0, 2.0, 2.0)
    end

    it 'returns the minimum of the top three when three judges disagree' do
      assert_equal 1, merge(implicit_book, 3.0, 2.0, 1.0)
      # Not monotonic: adding a 0 to [3, 3] drops the merged rating from 3 to 0.
      assert_equal 0, merge(implicit_book, 3.0, 3.0, 0.0)
    end

    it 'uses the top three when more than three judgements exist' do
      assert_equal 3, merge(implicit_book, 3.0, 3.0, 3.0, 1.0, 0.0)
      assert_equal 2, merge(implicit_book, 3.0, 2.0, 2.0, 1.0, 0.0)
      assert_equal 3, merge(implicit_book, 3.0, 3.0, 3.0, 0.0)
    end

    it 'handles implicit (float) ratings' do
      assert_in_delta 1.5, merge(implicit_book, 2.5, 2.5, 1.5)
    end
  end

  describe 'fitting to the scale' do
    it 'rounds the merged rating on an explicit book' do
      assert_equal 2, merge(explicit_book, 3.0, 0.0)
    end

    it 'keeps the float on an implicit book' do
      assert_in_delta 1.5, merge(implicit_book, 3.0, 0.0)
    end
  end

  it 'returns nil when there are no judgements' do
    assert_nil JudgementMerger.new(explicit_book).rating_for([])
  end
end
