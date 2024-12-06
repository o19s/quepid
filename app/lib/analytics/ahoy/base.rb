# frozen_string_literal: true

module Analytics
  module Ahoy
    module Base
      @ahoy = nil

      def enabled?
        true
      end

      def ahoy
        return unless enabled?

        # //@ahoy|| = Thread.current[:ahoy] # not sure about this!
        Thread.current[:ahoy]
      end
    end
  end
end
