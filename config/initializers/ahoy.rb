# frozen_string_literal: true

module Ahoy
  class Store < Ahoy::DatabaseStore
    # MCP tool calls (app/mcp/quepid_toolset.rb) come from programmatic clients
    # whose user agents bot detection would drop. They are always made with a
    # user's API key, so record them.
    def exclude?
      return false if @options[:mcp]

      super
    end
  end
end

# set to true for JavaScript tracking
Ahoy.api = true

# set to true for geocoding (and add the geocoder gem to your Gemfile)
# we recommend configuring local geocoding as well
# see https://github.com/ankane/ahoy#geocoding
Ahoy.geocode = false
