# frozen_string_literal: true

module Analytics
  module Tracker
    module SearchEndpoint
      def track_search_endpoint_shared_event _user, endpoint, _team
        track 'Search Endpoints', 'Shared a Search Endpoint', label: endpoint.fullname
      end
    end
  end
end
