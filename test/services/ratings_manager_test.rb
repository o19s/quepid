# frozen_string_literal: true

require 'test_helper'

class RatingsImporterTest < ActiveSupport::TestCase
  let(:user)                  { users(:random_1) }
  let(:case_with_ratings)     { cases(:random_case) }
  let(:case_without_ratings)  { cases(:random_case_1) }
  let(:book)                  { books(:james_bond_movies) }

  let(:create_missing_queries_options) do
    {
      create_missing_queries: true,
    }
  end

  describe 'refresh a case with no ratings' do
    it 'creates all the ratings needed' do
      assert_difference 'case_without_ratings.queries.count', 0 do
        assert_difference 'case_without_ratings.ratings.count', 2 do
          service = RatingsManager.new(book)
          service.sync_ratings_for_case(case_without_ratings)

          assert_equal 0, service.queries_created
          assert_equal 2, service.ratings_created
        end
      end
    end

    it 'creates all the ratings needed and queries too when requested' do
      assert_difference 'case_without_ratings.queries.count', 1 do
        assert_difference 'case_without_ratings.ratings.count', 3 do
          # sometimes we want to create new queries!
          service = RatingsManager.new(book, create_missing_queries_options)
          service.sync_ratings_for_case(case_without_ratings)

          assert_equal 1, service.queries_created
          assert_equal 3, service.ratings_created
        end
      end
    end

    it 'handles unrated docs' do
      # clear out ratings and mark as unrateable instead.
      book.judgements.each do |judgement|
        judgement.rating = nil
        judgement.unrateable = true
        judgement.save!
      end

      assert_difference 'case_without_ratings.queries.count', 0 do
        assert_difference 'case_without_ratings.ratings.count', 0 do
          service = RatingsManager.new(book)
          service.sync_ratings_for_case(case_without_ratings)

          assert_equal 0, service.queries_created
          assert_equal 0, service.ratings_created
        end
      end
    end
  end

  describe 'refresh a case with existing ratings' do
    it 'creates all the ratings needed' do
      assert_difference 'case_with_ratings.queries.count', 0 do
        assert_difference 'case_with_ratings.ratings.count', 2 do
          service = RatingsManager.new(book)
          service.sync_ratings_for_case(case_with_ratings)

          assert_equal 0, service.queries_created
          assert_equal 2, service.ratings_created
        end
      end

      # second time around, shouldn't be any changes
      assert_difference 'case_with_ratings.queries.count', 0 do
        assert_difference 'case_with_ratings.ratings.count', 0 do
          service = RatingsManager.new(book)
          service.sync_ratings_for_case(case_with_ratings)

          assert_equal 0, service.queries_created
          assert_equal 0, service.ratings_created
        end
      end
    end
  end
end
