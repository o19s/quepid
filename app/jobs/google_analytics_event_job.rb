# frozen_string_literal: true

class GoogleAnalyticsEventJob < ApplicationJob
  queue_as :default

  def perform _data
    return unless Analytics::GoogleAnalytics.enabled?

    nil # avoid NameError: uninitialized constant URI::PATTERN
    # Analytics::GoogleAnalytics.ga.event(
    #   data[:category],
    #   data[:action],
    #   data[:label],
    #   data[:value],
    #   data[:bounce] || false
    # )
  end
end
