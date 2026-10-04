# frozen_string_literal: true

require 'test_helper'

class JudgementSyncTest < ActiveSupport::TestCase
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
end
