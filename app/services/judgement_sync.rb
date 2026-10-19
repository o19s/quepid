# frozen_string_literal: true

# Only judgement commits trigger the forward sync. Ratings produced by that sync
# do not trigger reverse writes. Imports and AI judging collect changed pair ids
# without holding a transaction across long-running external requests.
module JudgementSync
  KEY = :quepid_judgement_sync_batch
  ACTIVITY_KEY = :quepid_judgement_activity_batch

  def self.changed pair_id
    batch = ActiveSupport::IsolatedExecutionState[KEY]
    if batch
      batch << pair_id
    else
      UpdateCaseRatingsJob.perform_later [ pair_id ]
    end
  end

  # Inside a batch, each book and judge gets one activity broadcast when the batch ends.
  def self.activity book, judge
    batch = ActiveSupport::IsolatedExecutionState[ACTIVITY_KEY]
    if batch
      batch << [ book, judge ]
    else
      BroadcastJudgeActivityJob.perform_later(book, judge)
    end
  end

  def self.batch
    return yield if ActiveSupport::IsolatedExecutionState[KEY]

    ids = []
    activity = []
    ActiveSupport::IsolatedExecutionState[KEY] = ids
    ActiveSupport::IsolatedExecutionState[ACTIVITY_KEY] = activity
    yield
  ensure
    if ids
      ActiveSupport::IsolatedExecutionState.delete(KEY)
      ActiveSupport::IsolatedExecutionState.delete(ACTIVITY_KEY)
      enqueue = ids.uniq
      UpdateCaseRatingsJob.perform_later(enqueue) if enqueue.any?
      activity.uniq { |book, judge| [ book.id, judge.id ] }.each do |book, judge|
        BroadcastJudgeActivityJob.perform_later(book, judge)
      end
    end
  end

  def self.from_ratings user, ratings
    ids = ratings.map(&:id).compact.uniq
    JudgementFromRatingJob.perform_later(user, ids) if user && ids.any?
  end
end
