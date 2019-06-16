# frozen_string_literal: true

module Analytics
  module GA
    module Base
      def ga
        @ga ||= Gabba::Gabba.new(ENV['QUEPID_GA'], ENV['QUEPID_DOMAIN'])
      end
    end
  end
end
