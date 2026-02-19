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

    # extract_docs delegates to FetchService which parses internally;
    # parse once here for the remaining metadata extractors.
    docs = extract_docs(response.body, atry, fetch_service)
    parsed = parse_json_safe(response.body)
    engine = atry.search_endpoint.search_engine.to_sym
    num_found = extract_num_found(parsed, engine)
    highlights = extract_highlights(parsed, engine)
    max_score = extract_max_score(parsed, engine)
    querqy_triggered = detect_querqy(parsed, engine)

    {
      docs:              docs.map { |d| doc_for_api(d, highlights) },
      num_found:         num_found,
      max_score:         max_score,
      querqy_triggered:  querqy_triggered,
      response_status:   response.status
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
    when :vectara
      fetch_service.extract_docs_from_response_body_for_vectara(response_body)
    when :algolia
      fetch_service.extract_docs_from_response_body_for_algolia(response_body)
    else
      []
    end
  rescue JSON::ParserError => e
    Rails.logger.warn("QuerySearchService: failed to parse response: #{e.message}")
    []
  end

  def extract_num_found(data, engine)
    return 0 if data.blank?

    case engine
    when :solr
      data.dig('response', 'numFound') || 0
    when :es, :os
      total = data.dig('hits', 'total')
      total.is_a?(Hash) ? total['value'] || 0 : total.to_i
    when :searchapi
      data['numberOfResults'] || data['total'] || 0
    when :vectara
      documents = data.dig('responseSet', 0, 'document')
      documents&.length || 0
    when :algolia
      data['nbHits'] || 0
    else
      0
    end
  end

  def doc_for_api(doc, highlights = {})
    result = {
      id:        doc[:id],
      position:  doc[:position],
      fields:    doc[:fields],
      explain:   doc[:explain]
    }.compact

    doc_highlights = highlights[doc[:id].to_s] || highlights[doc[:id]]
    result[:highlights] = doc_highlights if doc_highlights.present?

    result
  end

  def extract_highlights(data, engine)
    return {} if data.blank?

    case engine
    when :solr
      data.dig("highlighting") || {}
    when :es, :os
      hits = data.dig("hits", "hits") || []
      hits.each_with_object({}) do |hit, memo|
        hl = hit["highlight"]
        memo[hit["_id"]] = hl if hl.present?
      end
    else
      {}
    end
  end

  def extract_max_score(data, engine)
    return nil if data.blank?

    case engine
    when :solr
      data.dig("response", "maxScore")
    when :es, :os
      data.dig("hits", "max_score")
    else
      nil
    end
  end

  def detect_querqy(data, engine)
    return false if data.blank?

    case engine
    when :solr
      decorations = data.dig("responseHeader", "params", "querqy.decorations") ||
                    data.dig("querqy_decorations")
      decorations.present?
    when :es, :os
      data.dig("ext", "querqy").present?
    else
      false
    end
  end

  def parse_json_safe(str)
    return {} if str.blank?

    JSON.parse(str)
  rescue JSON::ParserError
    {}
  end
end
