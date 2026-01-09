# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength

require 'v8_mapper_executor'

class MapperWizardService
  class WizardError < StandardError; end

  def initialize api_key: nil
    @api_key = api_key
    @v8_executor = V8MapperExecutor.new(Rails.root.join('lib/mapper_code_logic.js'))
  end

  # Fetch HTML/JSON from a URL using HTTP GET or POST
  # @param url [String] The URL to fetch
  # @param http_method [String] 'GET' or 'POST' (default: 'GET')
  # @param request_body [String] JSON body for POST requests
  # @param headers [Hash] Custom HTTP headers
  # rubocop:disable Metrics/PerceivedComplexity
  def fetch_html url, http_method: 'GET', request_body: nil, headers: {}
    return { success: false, error: 'URL is required' } if url.blank?
    return { success: false, error: 'Invalid URL format' } unless url.match?(%r{\Ahttps?://.+}i)

    if 'GET' == http_method
      # Use existing DownloadPage tool for GET requests
      downloader = DownloadPage.new
      headers_json = headers.presence&.to_json
      result = downloader.execute(url: url, headers: headers_json)

      if result.is_a?(Hash) && result[:error]
        { success: false, error: result[:error] }
      else
        { success: true, html: result }
      end
    else
      # Handle POST requests with JSON body
      fetch_with_post(url, request_body, headers)
    end
  rescue StandardError => e
    { success: false, error: e.message }
  end
  # rubocop:enable Metrics/PerceivedComplexity

  # Generate mapper functions using RubyLLM
  # rubocop:disable Metrics/MethodLength
  def generate_mappers html_content
    return { success: false, error: 'API key required' } if @api_key.blank?
    return { success: false, error: 'HTML content required' } if html_content.blank?

    configure_ruby_llm

    chat = RubyLLM.chat(model: 'gpt-4o')

    chat.with_instructions(generation_prompt, replace: true)

    # Truncate HTML if too long to fit in context
    truncated_html = html_content.length > 50_000 ? html_content[0...50_000] : html_content

    response = chat.ask(<<~PROMPT)
      Analyze this HTML from a search results page and generate the JavaScript mapper functions.

      HTML Content:
      ```html
      #{truncated_html}
      ```

      Generate both numberOfResultsMapper and docsMapper functions. Wrap each function in a separate ```javascript code block.
    PROMPT

    extract_functions_from_response(response.content)
  rescue StandardError => e
    { success: false, error: "AI generation failed: #{e.message}" }
  end
  # rubocop:enable Metrics/MethodLength

  # Test a single mapper function
  # rubocop:disable Metrics/MethodLength
  def test_mapper mapper_type:, code:, html_content:
    return { success: false, error: 'Code is required', logs: [] } if code.blank?
    return { success: false, error: 'HTML content is required', logs: [] } if html_content.blank?

    # Clear logs before running
    @v8_executor.clear_logs

    # Build complete mapper code with stub for the other function
    full_code = case mapper_type
                when 'numberOfResultsMapper'
                  <<~JS
                    #{code}
                    docsMapper = function(data) { return []; }
                  JS
                when 'docsMapper'
                  <<~JS
                    numberOfResultsMapper = function(data) { return 0; }
                    #{code}
                  JS
                else
                  return { success: false, error: 'Invalid mapper type', logs: [] }
                end

    result = if 'numberOfResultsMapper' == mapper_type
               @v8_executor.extract_number_of_results(full_code, html_content)
             else
               @v8_executor.extract_docs(full_code, html_content)
             end

    { success: true, result: result, logs: @v8_executor.logs }
  rescue V8MapperExecutor::MapperError => e
    { success: false, error: "JavaScript error: #{e.message}", logs: @v8_executor.logs }
  rescue StandardError => e
    { success: false, error: e.message, logs: @v8_executor.logs }
  end
  # rubocop:enable Metrics/MethodLength

  # Refine a mapper function using AI
  # rubocop:disable Metrics/MethodLength
  def refine_mapper mapper_type:, current_code:, feedback:, html_content:
    return { success: false, error: 'API key required' } if @api_key.blank?

    configure_ruby_llm

    chat = RubyLLM.chat(model: 'gpt-4o')

    truncated_html = html_content.length > 30_000 ? html_content[0...30_000] : html_content

    response = chat.ask(<<~PROMPT)
      You are improving a JavaScript #{mapper_type} function for parsing search results HTML or JSON.

      Current code:
      ```javascript
      #{current_code}
      ```

      User feedback or issue: #{feedback}

      HTML or JSON sample (truncated):
      ```
      #{truncated_html}
      ```

      Please provide an improved version of the #{mapper_type} function that addresses the feedback.
      Return ONLY the improved function code wrapped in ```javascript code blocks.
      Use the format: #{mapper_type} = function(data) { ... }
      Target V8 engine only - no DOM APIs like document.querySelector.
      Use string methods: indexOf, substring, split, match (simple regex only).
      Please preserve any console.log or comments.
    PROMPT

    # Extract the improved code
    code_match = response.content.match(/```(?:javascript|js)?\s*\n(.*?)\n```/m)
    if code_match
      { success: true, code: code_match[1].strip }
    else
      { success: false, error: 'Could not extract improved code from AI response' }
    end
  rescue StandardError => e
    { success: false, error: "AI refinement failed: #{e.message}" }
  end
  # rubocop:enable Metrics/MethodLength

  private

  # Fetch content using POST request with JSON body
  def fetch_with_post url, request_body, custom_headers = {}
    headers = {
      'Content-Type' => 'application/json',
      'Accept'       => 'application/json, text/html, */*',
      'User-Agent'   => 'Quepid/1.0 (Web Scraper)',
    }.merge(custom_headers)

    client = HttpClientService.new(url, headers: headers, timeout: 30, open_timeout: 10)
    response = client.post(body: request_body)

    { success: true, html: response.body }
  rescue Faraday::ConnectionFailed => e
    { success: false, error: "Connection failed: #{e.message}" }
  rescue Faraday::TimeoutError
    { success: false, error: 'Request timed out' }
  rescue StandardError => e
    { success: false, error: e.message }
  end

  def configure_ruby_llm
    RubyLLM.configure do |config|
      config.openai_api_key = @api_key
    end
  end

  def generation_prompt
    <<~PROMPT
      You are a JavaScript expert helping create data extraction functions for Quepid.

      **Requirements:**
      - Generate two JavaScript functions: numberOfResultsMapper and docsMapper
      - Define functions as: functionName = function(data) {} (not function functionName())
      - Include brief comments explaining logic
      - Wrap ALL JavaScript code in ```javascript code blocks
      - Target V8 engine only (no DOM APIs like document.querySelector)
      - Use string parsing methods: indexOf, substring, split, match (simple regex only)
      - If the source is JSON not HTML, then do results = typeof data === 'string' ? JSON.parse(data) : data;


      **Function Specifications:**

      numberOfResultsMapper: Returns total number of search results found (integer)
      Example:
      ```javascript
      numberOfResultsMapper = function(data) {
        // Extract total results count from "About X results" text
        var match = data.match(/(\\d[\\d,]*)\\s+results?/i);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
      }
      ```

      docsMapper: Converts source data format to Quepid format with required "id" and "title" keys.
      Include additional attributes like "description", "url", "image" only if they exist for most results.
      Use URL as fallback "id" if no obvious "id" field exists.
      Example:
      ```javascript
      docsMapper = function(data) {
        var docs = [];
        // Find each result block and extract fields
        var blocks = data.split('<div class="result">');
        for (var i = 1; i < blocks.length; i++) {
          var block = blocks[i];
          var titleMatch = block.match(/<h3[^>]*>(.*?)<\\/h3>/);
          var urlMatch = block.match(/href="([^"]+)"/);
          if (titleMatch && urlMatch) {
            docs.push({
              id: urlMatch[1],
              title: titleMatch[1].replace(/<[^>]+>/g, '')
            });
          }
        }
        return docs;
      }
      ```

      Analyze the data to figure out if it's HTML or JSON first, then generate appropriate functions.
    PROMPT
  end

  # rubocop:disable Metrics/MethodLength
  def extract_functions_from_response content
    # Extract all JavaScript code blocks
    code_blocks = content.scan(/```(?:javascript|js)?\s*\n(.*?)\n```/m).flatten

    return { success: false, error: 'No JavaScript code found in response' } if code_blocks.empty?

    combined_code = code_blocks.join("\n\n")

    # Try to split into the two functions
    number_mapper = extract_single_function(combined_code, 'numberOfResultsMapper')
    docs_mapper = extract_single_function(combined_code, 'docsMapper')

    if number_mapper && docs_mapper
      {
        success:                  true,
        number_of_results_mapper: number_mapper,
        docs_mapper:              docs_mapper,
      }
    else
      # Return combined code as fallback with defaults for missing functions
      {
        success:                  true,
        number_of_results_mapper: number_mapper || "numberOfResultsMapper = function(data) {\n  return 0;\n}",
        docs_mapper:              docs_mapper || "docsMapper = function(data) {\n  return [];\n}",
      }
    end
  end

  # rubocop:enable Metrics/MethodLength
  # rubocop:disable Metrics/MethodLength, Metrics/PerceivedComplexity
  def extract_single_function code, function_name
    # Match function definition pattern
    pattern = /#{function_name}\s*=\s*function\s*\([^)]*\)\s*\{/

    return nil unless code.match?(pattern)

    # Find the start of this function
    start_match = code.match(pattern)
    return nil unless start_match

    start_index = start_match.begin(0)

    # Find the matching closing brace - start counting from the opening brace
    brace_count = 0
    end_index = start_index
    found_first_brace = false

    code[start_index..].each_char.with_index do |char, idx|
      if '{' == char
        brace_count += 1
        found_first_brace = true
      elsif '}' == char
        brace_count -= 1
      end

      if found_first_brace && brace_count.zero?
        end_index = start_index + idx
        break
      end
    end

    code[start_index..end_index]
  end
  # rubocop:enable Metrics/MethodLength, Metrics/PerceivedComplexity
end
# rubocop:enable Metrics/ClassLength
