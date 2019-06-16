# frozen_string_literal: true

require_relative 'google_analytics/base'
require_relative 'google_analytics/events'

module Analytics
  module GA
    extend Base
    extend Events
  end
end
