# frozen_string_literal: true

require_relative 'google_analytics/base'
require_relative 'google_analytics/events'

module Analytics
  module GoogleAnalytics
    extend Base
    extend Events
  end
end
