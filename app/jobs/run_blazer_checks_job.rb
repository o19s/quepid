# frozen_string_literal: true

class RunBlazerChecksJob < ApplicationJob
  def perform
    Blazer.run_checks
  end
end
