# frozen_string_literal: true

class EnqueueNightlyQueryRunnerJob < ApplicationJob
  queue_as :default

  def perform(*args)
    Case.all.nightly_run.each do |kase|
      try = kase.tries.first # new to old ;-)
      QueryRunnerJob.perform_later kase, try
    end
  end
end
