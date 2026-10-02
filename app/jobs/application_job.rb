# frozen_string_literal: true

class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock
  # retry_on ActiveRecord::Deadlocked

  # A job's arguments are re-resolved from the database (via GlobalID) right
  # before it runs, not serialized as data - if a record was deleted after
  # the job was enqueued but before it ran, there's nothing left to act on,
  # so let it go rather than leaving a permanently-failed job behind.
  discard_on ActiveJob::DeserializationError

  # Same idea as discard_on above, but for callers that need to resolve a
  # GlobalID mid-method (e.g. scanning other in-flight jobs' arguments) and
  # treat a since-deleted record as simply "not found" rather than an error.
  def self.safely_locate globalid
    GlobalID::Locator.locate(globalid)
  rescue ActiveRecord::RecordNotFound
    nil
  end
end
