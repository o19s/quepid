# frozen_string_literal: true

module ActiveSupport
  class TestCase
    teardown do
      if @analytics_calls
        assert @analytics_calls.any? { |name, properties|
          (@expected_analytics_name.nil? || name == @expected_analytics_name) &&
            (@expected_analytics_properties.nil? || properties == @expected_analytics_properties)
        }, "Expected analytics event #{@expected_analytics_name || '(any)'}, received #{@analytics_calls.inspect}"
      end
    end

    # Observe delivery while allowing Ahoy to persist the event normally.
    def expects_any_ga_event_call event_name = nil, properties = nil
      @expected_analytics_name = event_name
      @expected_analytics_properties = properties
      calls = @analytics_calls = []
      tracker = @controller.send(:ahoy)
      original_track = tracker.method(:track)
      tracker.define_singleton_method(:track) do |name, data = {}, options = {}|
        calls << [ name, data ]
        original_track.call(name, data, options)
      end
    end
  end
end
