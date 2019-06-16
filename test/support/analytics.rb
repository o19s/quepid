# frozen_string_literal: true

module ActiveSupport
  class TestCase
    def expects_any_ga_event_call
      Analytics::GA.ga
        .expects(:event)
        .with(any_parameters)
    end
  end
end
