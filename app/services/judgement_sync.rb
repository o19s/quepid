# frozen_string_literal: true

# Only judgement commits trigger the forward sync. Ratings produced by that sync
# do not trigger reverse writes. Imports and AI judging collect changed pair ids
# without holding a transaction across long-running external requests.
module JudgementSync
  KEY = :quepid_judgement_sync_batch

  def self.changed pair_id
    batch = ActiveSupport::IsolatedExecutionState[KEY]
    if batch
      batch << pair_id
    else
      UpdateCaseRatingsJob.perform_later [ pair_id ]
    end
  end

  def self.batch
    return yield if ActiveSupport::IsolatedExecutionState[KEY]

    ids = []
    ActiveSupport::IsolatedExecutionState[KEY] = ids
    yield
  ensure
    ActiveSupport::IsolatedExecutionState.delete(KEY) if ids
    enqueue = ids&.uniq || []
    UpdateCaseRatingsJob.perform_later(enqueue) if enqueue.any?
  end

  def self.from_ratings user, ratings
    ids = ratings.map(&:id).compact.uniq
    JudgementFromRatingJob.perform_later(user, ids) if user && ids.any?
  end
end
