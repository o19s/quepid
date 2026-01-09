# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength

class MapperWizardsController < ApplicationController
  before_action :require_admin_if_restricted
  before_action :set_search_endpoint, only: [ :show ]
  before_action :set_wizard_state, only: [ :fetch_html, :generate_mappers, :test_mapper, :refine_mapper, :save ]

  # GET /search_endpoints/mapper_wizard (new)
  # GET /search_endpoints/:search_endpoint_id/mapper_wizard (existing)
  def show
    @search_endpoint ||= SearchEndpoint.new

    # Reset wizard state when entering the wizard to start fresh
    # This prevents stale data from previous wizard sessions
    reset_wizard_state_for_user

    @wizard_state = MapperWizardState.new

    # Parse existing mapper_code from the search endpoint if editing
    if @search_endpoint.persisted? && @search_endpoint.mapper_code.present?
      parsed = parse_mapper_code(@search_endpoint.mapper_code)
      @existing_number_of_results_mapper = parsed[:number_of_results_mapper]
      @existing_docs_mapper = parsed[:docs_mapper]
      @has_existing_mappers = @existing_number_of_results_mapper.present? || @existing_docs_mapper.present?
    else
      @has_existing_mappers = false
    end
  end

  # POST /search_endpoints/:search_endpoint_id/mapper_wizard/fetch_html
  #
  # Note: This method stores large HTML content in the database (mapper_wizard_states table)
  # to avoid cookie overflow. The wizard state is tied to the user.
  #
  # Supports both GET and POST requests. For POST, accepts a JSON body.
  # query_params is stored separately and appended to search_url for fetching,
  # but NOT saved to the search endpoint (allows testing different queries).
  # rubocop:disable Metrics/MethodLength
  def fetch_html
    service = MapperWizardService.new
    http_method = params[:http_method] || 'GET'
    request_body = params[:request_body]
    query_params = params[:query_params]
    custom_headers = params[:custom_headers]
    basic_auth_credential = params[:basic_auth_credential]

    # Parse custom headers from JSON string to hash
    headers_hash = parse_custom_headers(custom_headers)

    # Build full URL with query params for fetching
    fetch_url = build_fetch_url(params[:search_url], query_params)

    result = service.fetch_html(
      fetch_url,
      http_method:  http_method,
      request_body: request_body,
      headers:      headers_hash,
      credentials:  basic_auth_credential
    )

    if result[:success]
      # Store base URL and query_params separately
      # Only search_url (without query_params) will be saved to the search endpoint
      @wizard_state.store_fetch_result(
        params[:search_url],
        result[:html],
        method:         http_method,
        body:           request_body,
        query_params:   query_params,
        custom_headers: custom_headers
      )

      render json: {
        success:      true,
        html_preview: result[:html],
        html_length:  result[:html].length,
      }
    else
      render json: { success: false, error: result[:error] }, status: :unprocessable_content
    end
  end
  # rubocop:enable Metrics/MethodLength

  # POST /search_endpoints/:search_endpoint_id/mapper_wizard/generate_mappers
  # rubocop:disable Metrics/MethodLength
  def generate_mappers
    if @wizard_state.html_content.blank?
      return render json:   { success: false, error: 'No HTML content. Fetch HTML first.' },
                    status: :unprocessable_content
    end
    if params[:api_key].blank?
      return render json:   { success: false, error: 'OpenAI API key required.' },
                    status: :unprocessable_content
    end

    service = MapperWizardService.new(api_key: params[:api_key])
    result = service.generate_mappers(@wizard_state.html_content)

    if result[:success]
      @wizard_state.store_mappers(
        number_of_results_mapper: result[:number_of_results_mapper],
        docs_mapper:              result[:docs_mapper]
      )

      render json: {
        success:                  true,
        number_of_results_mapper: result[:number_of_results_mapper],
        docs_mapper:              result[:docs_mapper],
      }
    else
      render json: { success: false, error: result[:error] }, status: :unprocessable_content
    end
  end
  # rubocop:enable Metrics/MethodLength

  # POST /search_endpoints/:search_endpoint_id/mapper_wizard/test_mapper
  def test_mapper
    if @wizard_state.html_content.blank?
      return render json:   { success: false, error: 'No HTML content.' },
                    status: :unprocessable_content
    end

    service = MapperWizardService.new
    result = service.test_mapper(
      mapper_type:  params[:mapper_type],
      code:         params[:code],
      html_content: @wizard_state.html_content
    )

    render json: result
  end

  # POST /search_endpoints/:search_endpoint_id/mapper_wizard/refine_mapper
  # rubocop:disable Metrics/MethodLength
  def refine_mapper
    if @wizard_state.html_content.blank?
      return render json:   { success: false, error: 'No HTML content.' },
                    status: :unprocessable_content
    end
    if params[:api_key].blank?
      return render json:   { success: false, error: 'OpenAI API key required.' },
                    status: :unprocessable_content
    end

    service = MapperWizardService.new(api_key: params[:api_key])
    result = service.refine_mapper(
      mapper_type:  params[:mapper_type],
      current_code: params[:current_code],
      feedback:     params[:feedback],
      html_content: @wizard_state.html_content
    )

    render json: result
  end
  # rubocop:enable Metrics/MethodLength

  # POST /search_endpoints/:search_endpoint_id/mapper_wizard/save
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def save
    @search_endpoint = if params[:search_endpoint_id].present? && 'new' != params[:search_endpoint_id]
                         current_user.search_endpoints_involved_with.find(params[:search_endpoint_id])
                       else
                         SearchEndpoint.new(owner: current_user)
                       end

    combined_code = combine_mapper_code(
      params[:number_of_results_mapper],
      params[:docs_mapper]
    )

    endpoint_url = params[:endpoint_url].presence || @wizard_state.search_url
    custom_headers = params[:custom_headers].presence || @wizard_state.custom_headers
    basic_auth_credential = params[:basic_auth_credential].presence || @search_endpoint.basic_auth_credential

    @search_endpoint.assign_attributes(
      mapper_code:           combined_code,
      search_engine:         'searchapi',
      endpoint_url:          endpoint_url,
      api_method:            params[:api_method] || 'GET',
      name:                  params[:name],
      proxy_requests:        deserialize_bool_param(params[:proxy_requests]),
      custom_headers:        custom_headers,
      basic_auth_credential: basic_auth_credential
    )

    if @search_endpoint.save
      clear_wizard_state
      render json: { success: true, redirect_url: search_endpoint_url(@search_endpoint) }
    else
      render json: { success: false, errors: @search_endpoint.errors.full_messages }, status: :unprocessable_content
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  private

  def require_admin_if_restricted
    return unless Rails.application.config.search_endpoint_views_admin_only
    return if current_user.administrator?

    redirect_to root_path, notice: 'Search Endpoint management is restricted to administrators.'
  end

  def set_search_endpoint
    return if params[:search_endpoint_id].blank? || 'new' == params[:search_endpoint_id]

    @search_endpoint = current_user.search_endpoints_involved_with.find_by(id: params[:search_endpoint_id])
    if @search_endpoint.nil?
      redirect_to search_endpoints_path,
                  alert: "Search endpoint you are looking for either doesn't exist or you don't have permissions."
    end
  end

  def set_wizard_state
    @wizard_state = MapperWizardState.find_or_create_for_user(current_user)
  end

  def combine_mapper_code number_of_results_mapper, docs_mapper
    <<~JS
      // numberOfResultsMapper - Returns total number of search results
      #{number_of_results_mapper}

      // docsMapper - Converts source data to Quepid format
      #{docs_mapper}
    JS
  end

  def clear_wizard_state
    @wizard_state&.destroy
  end

  def reset_wizard_state_for_user
    MapperWizardState.where(user: current_user).destroy_all
  end

  # Build full URL by appending query_params to base URL
  def build_fetch_url base_url, query_params
    return base_url if query_params.blank?

    separator = base_url.include?('?') ? '&' : '?'
    "#{base_url}#{separator}#{query_params}"
  end

  # Parse custom headers from JSON string to hash
  def parse_custom_headers custom_headers_json
    return {} if custom_headers_json.blank?

    JSON.parse(custom_headers_json)
  rescue JSON::ParserError
    {}
  end

  # Parse combined mapper_code back into separate functions
  def parse_mapper_code mapper_code
    return { number_of_results_mapper: nil, docs_mapper: nil } if mapper_code.blank?

    number_of_results_mapper = extract_function(mapper_code, 'numberOfResultsMapper')
    docs_mapper = extract_function(mapper_code, 'docsMapper')

    { number_of_results_mapper: number_of_results_mapper, docs_mapper: docs_mapper }
  end

  # Extract a JavaScript function from combined mapper code
  # Handles complex function bodies with nested structures, strings, and template literals
  # rubocop:disable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity, Metrics/BlockNesting
  def extract_function source, function_name
    functions = {}
    pattern = /(\w+)\s*=\s*function\s*\([^)]*\)\s*\{/
    offset = 0

    while (match = source.match(pattern, offset))
      name = match[1]
      cursor = match.end(0)
      brace_depth = 1
      in_single = false
      in_double = false
      in_line_comment = false
      in_block_comment = false

      # Walk forward counting braces while ignoring those inside strings/comments.
      while cursor < source.length && brace_depth.positive?
        char = source[cursor]
        nxt = source[cursor + 1]

        if in_line_comment
          in_line_comment = false if "\n" == char
        elsif in_block_comment
          if '*' == char && '/' == nxt
            in_block_comment = false
            cursor += 1
          end
        elsif in_single
          in_single = false if "'" == char && '\\' != source[cursor - 1]
        elsif in_double
          in_double = false if '"' == char && '\\' != source[cursor - 1]
        elsif '/' == char && '/' == nxt
          in_line_comment = true
          cursor += 1
        elsif '/' == char && '*' == nxt
          in_block_comment = true
          cursor += 1
        elsif "'" == char
          in_single = true
        elsif '"' == char
          in_double = true
        elsif '{' == char
          brace_depth += 1
        elsif '}' == char
          brace_depth -= 1
        end

        cursor += 1
      end

      function_text = source[match.begin(0)...cursor]
      functions[name] = function_text.strip
      offset = cursor
    end

    functions[function_name]
  end
  # rubocop:enable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity, Metrics/BlockNesting

  # Find the index of the closing brace that matches the opening brace at start_index
  # Handles strings (single/double quotes), template literals, and escaped characters
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def find_matching_brace code, start_index
    raise ArgumentError, "Character at start_index must be '{'" unless '{' == code[start_index]

    brace_count = 1
    idx = start_index + 1
    in_string = nil # nil, '"', "'", or '`'
    escape_next = false

    while idx < code.length
      char = code[idx]

      if escape_next
        escape_next = false
        idx += 1
        next
      end

      if '\\' == char
        escape_next = true
        idx += 1
        next
      end

      # Handle string/template literal boundaries
      if in_string
        in_string = nil if char == in_string
      elsif [ '"', "'", '`' ].include?(char)
        in_string = char
      elsif in_string.nil?
        # Only count braces when not inside a string or template literal
        brace_count += 1 if '{' == char
        brace_count -= 1 if '}' == char

        return idx if brace_count.zero?
      end

      idx += 1
    end

    # If we get here, matching brace was not found
    start_index
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Metrics/ClassLength
end
