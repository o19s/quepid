# frozen_string_literal: true

require_relative 'tracker/book'
require_relative 'tracker/case'
require_relative 'tracker/query'
require_relative 'tracker/rating'
require_relative 'tracker/scorer'
require_relative 'tracker/snapshot'
require_relative 'tracker/team'
require_relative 'tracker/try'
require_relative 'tracker/user'
require_relative 'tracker/search_endpoint'

module Analytics
  # Domain modules define named events; delivery stays shared here.
  module Tracker
    extend Book
    extend Case
    extend Query
    extend Rating
    extend Scorer
    extend Snapshot
    extend Team
    extend Try
    extend User
    extend SearchEndpoint

    class << self
      private

      def track category, action, label:, value: nil, **properties
        data = {
          category: category,
          action:   action,
          label:    label,
          value:    value,
        }.merge(properties)
        name = "#{category.parameterize(separator: '_')}:#{action.parameterize(separator: '_')}"
        Thread.current[:ahoy].track name, data
      end
    end
  end
end
