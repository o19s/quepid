# frozen_string_literal: true

# Executes a single query against a try's search endpoint and returns documents
# and metadata. Used by the query execution API for the modern workspace.
#
# Validates that the try has a search endpoint; returns an error hash if not.
# The controller also performs these checks; this guard provides robustness when
# the service is called from other paths (e.g. jobs or APIs).
#
# @see Api::V1::Tries::Queries::SearchController
# @see FetchService (reuses make_request and doc extraction)
class QuerySearchService
  # @param atry [Try] The try (search configuration) to use; must have a non-static search endpoint
  # @param query [Query] The query to execute (provides options, field_spec context)
  # @param query_text_override [String, nil] Optional. When present, search with this text instead of
  #   query.query_text. Used by DocFinder ("Find and rate missing documents").
  # @param rows [Integer, nil] Optional. Override number of rows to return (default: try's number_of_rows).
  # @param start [Integer, nil] Optional. Pagination offset (default: 0).
  # @return [Hash] { docs: [...], num_found: N, response_status: Integer } or { error: String, response_status: Integer }
  def execute(atry, query, query_text_override: nil, rows: nil, start: nil)
    return { error: "No search endpoint defined for try number #{atry.try_number}", response_status: 400 } if atry.search_endpoint.nil?

    fetch_service = FetchService.new(fake_mode: false, debug_mode: false)
    response = fetch_service.make_request(
      atry,
      query,
      query_text_override: query_text_override,
      rows: rows,
      start: start
    )

    return error_response(response) unless response.status == 200

    docs = extract_docs(response.body, atry, fetch_service)
    num_found = extract_num_found(response.body, atry)

    {
      docs:            docs.map { |d| doc_for_api(d) },
      num_found:       num_found,
      response_status: response.status
    }
  end

  private

  def error_response(response)
    body = parse_json_safe(response.body)
    message = body['error'] || body['message'] || "Search returned #{response.status}"
    { error: message, response_status: response.status }
  end

  def extract_docs(response_body, atry, fetch_service)
    search_endpoint = atry.search_endpoint
    case search_endpoint.search_engine.to_sym
    when :solr
      fetch_service.extract_docs_from_response_body_for_solr(response_body)
    when :es
      fetch_service.extract_docs_from_response_body_for_es(response_body)
    when :os
      fetch_service.extract_docs_from_response_body_for_os(response_body)
    when :searchapi
      fetch_service.extract_docs_from_response_body_for_searchapi(
        search_endpoint.mapper_code,
        response_body
      )
    when :vectara, :algolia
      # TODO: add extraction when supported
      []
    else
      []
    end
  rescue JSON::ParserError => e
    Rails.logger.warn("QuerySearchService: failed to parse response: #{e.message}")
    []
  end

  def extract_num_found(response_body, atry)
    data = parse_json_safe(response_body)
    return 0 if data.blank?

    case atry.search_endpoint.search_engine.to_sym
    when :solr
      data.dig('response', 'numFound') || 0
    when :es, :os
      total = data.dig('hits', 'total')
      total.is_a?(Hash) ? total['value'] || 0 : total.to_i
    when :searchapi
      # SearchAPI uses mapper; num_found may be in response
      data['numberOfResults'] || data['total'] || 0
    else
      0
    end
  end

  def doc_for_api(doc)
    {
      id:        doc[:id],
      position:  doc[:position],
      fields:    doc[:fields],
      explain:   doc[:explain]
    }.compact
  end

  def parse_json_safe(str)
    return {} if str.blank?

    JSON.parse(str)
  rescue JSON::ParserError
    {}
  end
end
