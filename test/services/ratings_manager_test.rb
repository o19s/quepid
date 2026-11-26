# frozen_string_literal: true

require 'test_helper'

class RatingsImporterTest < ActiveSupport::TestCase
  cover 'RatingsManager*'

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

  describe 'sync_ratings_for_query_doc_pair respects auto_populate flag' do
    let(:qdp_with_judgement) { query_doc_pairs(:jbm_qdp1) }

    it 'skips cases with auto_populate_case_judgements disabled' do
      case_with_ratings.update!(book: book, auto_populate_case_judgements: false)

      assert_no_difference 'case_with_ratings.ratings.count' do
        service = RatingsManager.new(book)
        service.sync_ratings_for_query_doc_pair(qdp_with_judgement)
      end
    end

    it 'syncs cases with auto_populate_case_judgements enabled' do
      case_without_ratings.update!(book: book, auto_populate_case_judgements: true)

      assert_difference 'case_without_ratings.ratings.count', 1 do
        service = RatingsManager.new(book)
        service.sync_ratings_for_query_doc_pair(qdp_with_judgement)
      end
    end
  end

  describe 'the book judgement merging reaches its cases' do
    let(:merging_book) { Book.create!(name: 'Merging', scale: [ 0, 1, 2, 3 ], owner: user) }
    let(:kase) { Case.create!(case_name: 'Merging case', owner: user, book: merging_book, auto_populate_case_judgements: true) }

    def case_rating
      Rating.joins(:query).find_by(queries: { case_id: kase.id }, doc_id: 'doc1')&.rating
    end

    it 'rates the case by the rule and tiers, and resyncs when they change' do
      merging_book.update!(judgement_merge_rule: 'mean', judgement_merge_tiers: %w[human ai])
      kase.queries.create!(query_text: 'dog')
      pair = merging_book.query_doc_pairs.create!(query_text: 'dog', doc_id: 'doc1')

      perform_enqueued_jobs do
        pair.judgements.create!(user: users(:random), rating: 3.0)
        pair.judgements.create!(user: users(:judge_judy), rating: 0.0)
      end

      assert_in_delta 3.0, case_rating # human first: the AI 0 is ignored

      perform_enqueued_jobs do
        merging_book.update!(judgement_merge_rule: 'min', judgement_merge_tiers: nil)
      end

      assert_in_delta 0.0, case_rating # every judge counts, the lowest wins
    end

    it 'resyncs the case when a judgement moves to another kind of judge' do
      merging_book.update!(judgement_merge_rule: 'mean', judgement_merge_tiers: %w[human ai anonymous])
      kase.queries.create!(query_text: 'dog')
      pair = merging_book.query_doc_pairs.create!(query_text: 'dog', doc_id: 'doc1')
      anonymous = nil

      perform_enqueued_jobs do
        anonymous = pair.judgements.create!(user: nil, rating: 3.0)
        pair.judgements.create!(user: users(:judge_judy), rating: 0.0)
      end

      assert_in_delta 0.0, case_rating # no human yet, so the AI tier wins

      # What "Assign Anonymous Judgements to a User" on the book does.
      perform_enqueued_jobs { anonymous.update!(user: users(:random)) }

      assert_in_delta 3.0, case_rating # now a human judgement, which comes first
    end
  end
end
