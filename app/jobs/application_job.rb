# frozen_string_literal: true

class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock
  # retry_on ActiveRecord::Deadlocked

  # GlobalID arguments can disappear between enqueue and execution.
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
