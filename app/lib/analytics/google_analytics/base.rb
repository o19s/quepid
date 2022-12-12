# frozen_string_literal: true

module Analytics
  module GoogleAnalytics
    module Base
      def enabled?
        # Unset values, empty strings, and "UA-" should all be treated as
        # disabled.
        Rails.application.config.google_analytics.length > 3
      end

      def ga
        return unless enabled?

        @ga ||= Gabba::Gabba.new(Rails.application.config.google_analytics, Rails.application.config.quepid_domain)
      end
    end
  end
end
