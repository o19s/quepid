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

  describe 'calculate_rating_from_judgements (optimistic-pessimistic approach)' do
    let(:star_wars_book) { books(:book_of_star_wars_judgements) }
    let(:service)        { RatingsManager.new(star_wars_book) }

    def create_judgements_with_ratings query_doc_pair, ratings_array
      ratings_array.each_with_index do |rating, index|
        # Create a unique user for each judgement to avoid uniqueness constraint
        user = User.create!(
          email:    "judge_#{query_doc_pair.id}_#{index}@example.com",
          password: 'password123',
          agreed:   true
        )
        query_doc_pair.judgements.create!(user: user, rating: rating)
      end
      query_doc_pair.judgements.rateable
    end

    it 'returns the single rating when only one judgement exists' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc1')
      judgements = create_judgements_with_ratings(qdp, [ 2 ])

      assert_equal 2, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'returns the rating when two judges agree' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc2')
      judgements = create_judgements_with_ratings(qdp, [ 3, 3 ])

      assert_equal 3, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'returns the minimum when two judges disagree' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc3')
      judgements = create_judgements_with_ratings(qdp, [ 3, 2 ])

      assert_equal 2, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'returns the rating when three judges agree' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc4')
      judgements = create_judgements_with_ratings(qdp, [ 2, 2, 2 ])

      assert_equal 2, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'returns minimum of top 3 when three judges disagree' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc5')
      judgements = create_judgements_with_ratings(qdp, [ 3, 2, 1 ])

      # Top 3 are [3, 2, 1], min is 1
      assert_equal 1, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'uses top 3 highest ratings when more than 3 judgements exist and they agree' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc6')
      # 5 judgements: [3, 3, 3, 1, 0] - top 3 are all 3s, which agree
      judgements = create_judgements_with_ratings(qdp, [ 3, 3, 3, 1, 0 ])

      assert_equal 3, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'returns minimum of top 3 when more than 3 judgements exist and top 3 disagree' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc7')
      # 5 judgements: [3, 2, 2, 1, 0] - top 3 are [3, 2, 2], min is 2
      judgements = create_judgements_with_ratings(qdp, [ 3, 2, 2, 1, 0 ])

      assert_equal 2, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'ignores lower ratings when determining consensus among top 3' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc8')
      # 4 judgements: [3, 3, 3, 0] - top 3 all agree on 3, the 0 is ignored
      judgements = create_judgements_with_ratings(qdp, [ 3, 3, 3, 0 ])

      assert_equal 3, service.send(:calculate_rating_from_judgements, judgements)
    end

    it 'handles implicit (float) ratings' do
      qdp = star_wars_book.query_doc_pairs.create!(query_text: 'test', doc_id: 'doc9')
      judgements = create_judgements_with_ratings(qdp, [ 2.5, 2.5, 1.5 ])

      # Top 3 are [2.5, 2.5, 1.5], they disagree, min is 1.5
      assert_in_delta(1.5, service.send(:calculate_rating_from_judgements, judgements))
    end
  end
end
