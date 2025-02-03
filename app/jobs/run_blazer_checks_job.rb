# frozen_string_literal: true

class RunBlazerChecksJob < ApplicationJob
  queue_as :default

  def perform
    Blazer.run_checks
  end
end
