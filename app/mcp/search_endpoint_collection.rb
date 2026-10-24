# frozen_string_literal: true

# Credential columns (basic_auth_credential, custom_headers) and mapper code are
# deliberately left out of `fields`, which the gem enforces as a whitelist.
class SearchEndpointCollection < QuepidCollection
  model SearchEndpoint
  description 'A search engine that cases query.'
  fields :id, :name, :search_engine, :endpoint_url, :api_method, :archived, :proxy_requests,
         :requests_per_minute, :created_at, :updated_at

  computed :owner_id, :integer, sql: '{table}.owner_id', doc: 'id of the owning user (no user collection)'

  instructions <<~TXT
    A search engine a case queries: URL, engine type ("solr", "es", "os", "vectara",
    "searchapi", ...) and HTTP method. Cases reach it through "try" (try.search_endpoint).
  TXT

  def scope_for user
    user.search_endpoints_involved_with
  end
end
