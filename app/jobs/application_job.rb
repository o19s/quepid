# frozen_string_literal: true

class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock
  # retry_on ActiveRecord::Deadlocked

  # GlobalID arguments can disappear between enqueue and execution.
  discard_on ActiveJob::DeserializationError
end
