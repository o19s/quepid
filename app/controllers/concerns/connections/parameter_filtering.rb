# frozen_string_literal: true

module Connections
  module ParameterFiltering
    extend ActiveSupport::Concern

    private

    def permitted_connection_params
      params.expect(connection: [ :name, :provider, :base_url, :auth_scheme, :auth_header, :secret, :timeout,
                                  :requests_per_minute, :api_version, :extra_headers_text,
                                  :retry_max, :retry_statuses_text, :retry_interval ])
    end
  end
end
