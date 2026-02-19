# frozen_string_literal: true

module Api
  module V1
    module SearchEndpoints
      # Returns field names from a search endpoint's schema.
      # GET /api/v1/search_endpoints/:search_endpoint_id/fields
      class FieldsController < Api::ApiController
        before_action :set_search_endpoint

        def index
          fields = fetch_fields
          render json: { fields: fields }
        rescue StandardError => e
          render json: { fields: [], error: e.message }, status: :ok
        end

        private

        def set_search_endpoint
          @search_endpoint = current_user.search_endpoints_involved_with.find(params[:search_endpoint_id])
        end

        def fetch_fields
          case @search_endpoint.search_engine.downcase
          when 'solr'
            fetch_solr_fields
          when 'es', 'elasticsearch', 'os', 'opensearch'
            fetch_es_fields
          else
            []
          end
        end

        def fetch_solr_fields
          # Derive admin/luke URL from the select URL
          base_url = @search_endpoint.endpoint_url.to_s
          # Replace /select or /query with /admin/luke
          luke_url = base_url.sub(%r{/(select|query)(\?.*)?$}, '/admin/luke?numTerms=0&wt=json')

          response = make_request(luke_url)
          data = JSON.parse(response.body)
          (data['fields'] || {}).keys.sort
        end

        def fetch_es_fields
          # Derive mapping URL from search URL
          base_url = @search_endpoint.endpoint_url.to_s
          # Remove /_search or /_search/template suffix
          mapping_url = base_url.sub(%r{/_search(/template)?(\?.*)?$}, '/_mapping')

          response = make_request(mapping_url)
          data = JSON.parse(response.body)
          extract_es_fields(data).sort.uniq
        end

        def extract_es_fields data, prefix = ''
          fields = []
          if data.is_a?(Hash)
            if data['properties']
              data['properties'].each do |name, config|
                full_name = prefix.present? ? "#{prefix}.#{name}" : name
                fields << full_name
                fields.concat(extract_es_fields(config, full_name))
              end
            else
              data.each_value do |v|
                fields.concat(extract_es_fields(v, prefix)) if v.is_a?(Hash)
              end
            end
          end
          fields
        end

        def make_request url
          uri = URI.parse(url)
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = ('https' == uri.scheme)
          http.open_timeout = 5
          http.read_timeout = 10
          http.verify_mode = OpenSSL::SSL::VERIFY_PEER

          request = Net::HTTP::Get.new(uri.request_uri)

          # Add basic auth if configured
          if @search_endpoint.basic_auth_credential.present?
            user, pass = @search_endpoint.basic_auth_credential.split(':', 2)
            request.basic_auth(user, pass)
          end

          # Add custom headers if configured
          if @search_endpoint.custom_headers.present?
            headers = @search_endpoint.custom_headers
            headers = JSON.parse(headers) if headers.is_a?(String)
            headers.each { |k, v| request[k] = v } if headers.is_a?(Hash)
          end

          http.request(request)
        end
      end
    end
  end
end
