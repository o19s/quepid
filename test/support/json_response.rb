# frozen_string_literal: true

module ActiveSupport
  class TestCase
    def json_response force = false
      if force
        @json_response = ::JSON.parse(response.body)
      else
        @json_response ||= ::JSON.parse(response.body)
      end
    end
  end
end
