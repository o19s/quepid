# frozen_string_literal: true

class EnqueueRunNightlyCasesJob < ApplicationJob
  queue_as :default

  def perform(*_args)
    Case.all.nightly_run.each do |kase|
      try = kase.tries.first # new to old ;-)
      RunCaseEvJob.perform_later kase, try
    end
  end
end
