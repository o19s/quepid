# frozen_string_literal: true

require 'test_helper'

class JudgementMergerTest < ActiveSupport::TestCase
  cover 'JudgementMerger*'

  let(:explicit_book) { Book.new(scale: [ 0, 1, 2, 3 ]) }
  let(:implicit_book) { Book.new(scale: [ 0, 1, 2, 3 ], support_implicit_judgements: true) }

  def judgements *ratings, user: nil
    ratings.map { |rating| Judgement.new(rating: rating, user: user) }
  end

  def merge book, *ratings
    JudgementMerger.new(book).rating_for(judgements(*ratings))
  end

  def implicit_book_with rule, tiers = nil
    Book.new(support_implicit_judgements: true, judgement_merge_rule: rule, judgement_merge_tiers: tiers)
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

  describe 'built-in rules' do
    it 'mean averages every rating' do
      assert_in_delta 1.0, merge(implicit_book_with('mean'), 3.0, 0.0, 0.0)
    end

    it 'median takes the middle rating, or the mean of the two middle ones' do
      assert_in_delta 1.0, merge(implicit_book_with('median'), 3.0, 1.0, 0.0)
      assert_in_delta 1.5, merge(implicit_book_with('median'), 3.0, 2.0, 1.0, 0.0)
    end

    it 'min and max take the extremes' do
      assert_equal 0, merge(implicit_book_with('min'), 3.0, 2.0, 0.0)
      assert_equal 3, merge(implicit_book_with('max'), 3.0, 2.0, 0.0)
    end

    it 'majority takes the most common rating' do
      assert_equal 0, merge(implicit_book_with('majority'), 3.0, 0.0, 0.0)
    end

    it 'first takes the rating of the earliest judgement' do
      book = implicit_book_with('first')
      later = Judgement.new(rating: 0.0, created_at: 1.hour.ago)
      earliest = Judgement.new(rating: 3.0, created_at: 2.hours.ago)

      assert_equal 3, JudgementMerger.new(book).rating_for([ later, earliest ])
    end

    it 'first applies after the precedence tiers' do
      book = implicit_book_with('first', %w[human])
      ai_earliest = Judgement.new(rating: 0.0, created_at: 2.hours.ago, user: users(:judge_judy))
      human_later = Judgement.new(rating: 2.0, created_at: 1.hour.ago, user: users(:random))

      assert_equal 2, JudgementMerger.new(book).rating_for([ ai_earliest, human_later ])
    end

    it 'majority falls back to the median on a tie' do
      assert_in_delta 1.5, merge(implicit_book_with('majority'), 3.0, 3.0, 0.0, 0.0)
    end
  end

  describe 'precedence tiers' do
    let(:human)    { users(:random) }
    let(:ai_judge) { users(:judge_judy) }

    def merge_mixed book
      JudgementMerger.new(book).rating_for(
        judgements(3.0, user: human) + judgements(0.0, user: ai_judge) + judgements(1.0)
      )
    end

    it 'uses only the first tier that has judgements' do
      assert_equal 3, merge_mixed(implicit_book_with('mean', %w[human ai]))
      assert_equal 0, merge_mixed(implicit_book_with('mean', %w[ai human]))
    end

    it 'falls through to the next tier when the first has no judgements' do
      book = implicit_book_with('mean', %w[human ai])
      ratings = judgements(0.0, user: ai_judge) + judgements(2.0)

      assert_equal 0, JudgementMerger.new(book).rating_for(ratings)
    end

    it 'treats unlisted judge kinds as one last tier' do
      book = implicit_book_with('mean', %w[human])
      ratings = judgements(0.0, user: ai_judge) + judgements(2.0)

      assert_in_delta 1.0, JudgementMerger.new(book).rating_for(ratings)
    end

    it 'merges every judgement when the book has no tiers' do
      assert_in_delta 4.0 / 3, merge_mixed(implicit_book_with('mean'))
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
