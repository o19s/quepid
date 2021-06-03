# frozen_string_literal: true

class GoogleAnalyticsEventJob < ApplicationJob
  queue_as :default

  def perform data
    return unless Analytics::GA.enabled?

    Analytics::GA.ga.event(
      data[:category],
      data[:action],
      data[:label],
      data[:value],
      data[:bounce] || false
    )
  end
end
