# frozen_string_literal: true

require 'test_helper'

class JudgementSyncTest < ActiveSupport::TestCase
  cover 'JudgementSync*'
  cover 'RatingsImporter*'

  setup do
    @pair = books(:james_bond_movies).query_doc_pairs.create!(query_text: 'sync verification', doc_id: 'sync-doc')
  end

  test 'create update and destroy enqueue once while explanation-only updates do not' do
    judgement = nil
    assert_enqueued_jobs 1, only: UpdateCaseRatingsJob do
      judgement = @pair.judgements.create!(user: users(:doug), rating: 1)
    end
    assert_no_enqueued_jobs only: UpdateCaseRatingsJob do
      judgement.update!(explanation: 'Explanation only')
    end
    assert_enqueued_jobs 1, only: UpdateCaseRatingsJob do
      judgement.update!(rating: 2)
    end
    assert_enqueued_jobs 1, only: UpdateCaseRatingsJob do
      judgement.destroy!
    end
  end

  test 'bulk changes coalesce pair ids including durable changes before a failure' do
    assert_enqueued_with(job: UpdateCaseRatingsJob, args: [ [ @pair.id ] ]) do
      assert_raises(RuntimeError) do
        JudgementSync.batch do
          @pair.judgements.create!(user: users(:doug), rating: 1)
          @pair.judgements.create!(user: users(:random), rating: 2)
          raise 'external operation failed after committed writes'
        end
      end
    end
  end

  test 'each judgement outside a batch broadcasts judge activity' do
    other_pair = @pair.book.query_doc_pairs.create!(query_text: 'sync verification', doc_id: 'other-doc')

    assert_enqueued_jobs 2, only: BroadcastJudgeActivityJob do
      @pair.judgements.create!(user: users(:doug), rating: 1)
      other_pair.judgements.create!(user: users(:doug), rating: 2)
    end
  end

  test 'a batch broadcasts judge activity once per book and judge' do
    other_pair = @pair.book.query_doc_pairs.create!(query_text: 'sync verification', doc_id: 'other-doc')

    assert_enqueued_jobs 2, only: BroadcastJudgeActivityJob do
      JudgementSync.batch do
        @pair.judgements.create!(user: users(:doug), rating: 1)
        other_pair.judgements.create!(user: users(:doug), rating: 2)
        @pair.judgements.create!(user: users(:random), rating: 3)
        assert_no_enqueued_jobs only: BroadcastJudgeActivityJob
      end
    end
  end

  test 'rolled back judgement changes do not enqueue sync' do
    assert_no_enqueued_jobs only: UpdateCaseRatingsJob do
      Judgement.transaction do
        @pair.judgements.create!(user: users(:doug), rating: 1)
        raise ActiveRecord::Rollback
      end
    end
  end

  test 'rating imports sync the importing user to the book without a feedback loop' do
    kase = cases(:random_case)
    kase.update!(book: @pair.book)
    perform_enqueued_jobs only: JudgementFromRatingJob do
      RatingsImporter.new(kase, [ { query_text: @pair.query_text, doc_id: @pair.doc_id, rating: 3 } ],
                          format: :hash, user: users(:doug)).import
    end
    assert_equal 3, @pair.judgements.find_by!(user: users(:doug)).rating
    assert_no_enqueued_jobs only: JudgementFromRatingJob do
      perform_enqueued_jobs only: UpdateCaseRatingsJob
    end
  end

  # Exact-argument checks: assert_enqueued_with passes when any enqueued job matches, which
  # lets a mutant that skips batching (or mangles the arguments) survive.
  test 'changed outside a batch enqueues one sync job for exactly that pair' do
    JudgementSync.changed(@pair.id)

    assert_equal [ [ [ @pair.id ] ] ], enqueued_args(UpdateCaseRatingsJob)
  end

  test 'changed inside a batch defers one sync job with the unique pair ids' do
    other_pair = @pair.book.query_doc_pairs.create!(query_text: 'sync verification', doc_id: 'other-doc')

    JudgementSync.batch do
      JudgementSync.changed(@pair.id)
      JudgementSync.changed(other_pair.id)
      JudgementSync.changed(@pair.id)
      assert_empty enqueued_args(UpdateCaseRatingsJob)
    end

    assert_equal [ [ [ @pair.id, other_pair.id ] ] ], enqueued_args(UpdateCaseRatingsJob)
  end

  test 'an empty batch enqueues nothing and clears its state' do
    result = JudgementSync.batch { :block_value }

    assert_equal :block_value, result
    assert_empty enqueued_args(UpdateCaseRatingsJob)
    assert_empty enqueued_args(BroadcastJudgeActivityJob)
    assert_nil ActiveSupport::IsolatedExecutionState[JudgementSync::KEY]
    assert_nil ActiveSupport::IsolatedExecutionState[JudgementSync::ACTIVITY_KEY]
  end

  test 'a nested batch joins the outer batch and returns its block value' do
    inner_result = nil
    JudgementSync.batch do
      JudgementSync.changed(@pair.id)
      inner_result = JudgementSync.batch do
        JudgementSync.changed(@pair.id + 1)
        :inner_value
      end
      assert_equal :inner_value, inner_result
      assert_empty enqueued_args(UpdateCaseRatingsJob)
      assert_not_nil ActiveSupport::IsolatedExecutionState[JudgementSync::KEY]
      JudgementSync.changed(@pair.id + 2)
    end

    assert_equal [ [ [ @pair.id, @pair.id + 1, @pair.id + 2 ] ] ], enqueued_args(UpdateCaseRatingsJob)
    assert_nil ActiveSupport::IsolatedExecutionState[JudgementSync::KEY]
  end

  test 'activity outside a batch broadcasts that book and judge immediately' do
    JudgementSync.activity(@pair.book, users(:doug))

    assert_equal [ [ @pair.book, users(:doug) ] ], enqueued_args(BroadcastJudgeActivityJob)
  end

  test 'a batch broadcasts one activity per distinct book and judge with those arguments' do
    other_book = books(:book_of_comedy_films)
    doug = users(:doug)
    random = users(:random)

    JudgementSync.batch do
      JudgementSync.activity(@pair.book, doug)
      JudgementSync.activity(@pair.book, doug)
      JudgementSync.activity(@pair.book, random)
      JudgementSync.activity(other_book, doug)
      assert_empty enqueued_args(BroadcastJudgeActivityJob)
    end

    assert_equal [ [ @pair.book, doug ], [ @pair.book, random ], [ other_book, doug ] ],
                 enqueued_args(BroadcastJudgeActivityJob)
  end

  test 'from_ratings enqueues the user and the unique non-nil rating ids' do
    ratings = [ Struct.new(:id).new(3), Struct.new(:id).new(nil), Struct.new(:id).new(3), Struct.new(:id).new(5) ]
    JudgementSync.from_ratings(users(:doug), ratings)

    assert_equal [ [ users(:doug), [ 3, 5 ] ] ], enqueued_args(JudgementFromRatingJob)
  end

  test 'from_ratings enqueues nothing without a user or without saved ratings' do
    JudgementSync.from_ratings(nil, [ Struct.new(:id).new(1) ])
    JudgementSync.from_ratings(users(:doug), [])
    JudgementSync.from_ratings(users(:doug), [ Struct.new(:id).new(nil) ])

    assert_empty enqueued_args(JudgementFromRatingJob)
  end

  private

  def enqueued_args job_class
    queue_adapter.enqueued_jobs.select { |job| job['job_class'] == job_class.name }
      .map { |job| ActiveJob::Arguments.deserialize(job['arguments']) }
  end
end
