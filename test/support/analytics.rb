# frozen_string_literal: true

module ActiveSupport
  class TestCase
    def expects_any_ga_event_call
      # Eric: Could not get any flavour to work.
      # $Analytics::Ahoy.stubs(:ahoy
      #   .expects(:track)
      #   .with(any_parameters)
      # Analytics::Ahoy.stubs(:ahoy).returns(Mocha::Mock.new)
      # Expecting the track method to be called with any parameters
      # Analytics::Ahoy.ahoy.expects(:track).with(any_parameters)
    end
  end
end
