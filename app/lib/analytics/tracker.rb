# frozen_string_literal: true

require_relative 'ahoy'
require_relative 'tracker/case'
require_relative 'tracker/query'
require_relative 'tracker/rating'
require_relative 'tracker/scorer'
require_relative 'tracker/snapshot'
require_relative 'tracker/team'
require_relative 'tracker/try'
require_relative 'tracker/user'

module Analytics
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
  end
end
