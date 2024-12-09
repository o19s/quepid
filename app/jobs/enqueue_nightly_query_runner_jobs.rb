# frozen_string_literal: true

class EnqueueNightlyQueryRunnerJobs < ApplicationJob
  queue_as :default

  def perform
    Case.all.nightly_run.each do |kase|
      try = kase.tries.last
      QueryRunnerJob.perform_later kase, try
    end
  end
end
