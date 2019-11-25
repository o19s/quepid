# frozen_string_literal: true

module Analytics
  module GA
    module Base
      def enabled?
        # Unset values, empty strings, and "UA-" should all be treated as
        # disabled.
        ENV.fetch('QUEPID_GA', '').length > 3
      end

      def ga
        return unless enabled?

        @ga ||= Gabba::Gabba.new(ENV['QUEPID_GA'], ENV['QUEPID_DOMAIN'])
      end
    end
  end
end
