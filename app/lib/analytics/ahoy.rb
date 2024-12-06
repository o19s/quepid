# frozen_string_literal: true

require_relative 'ahoy/base'
require_relative 'ahoy/events'

module Analytics
  module Ahoy
    extend Base
    extend Events
  end
end
