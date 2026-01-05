# frozen_string_literal: true

require 'test_helper'

class MapperWizardServiceTest < ActiveSupport::TestCase
  test 'fetch_html returns error for blank URL' do
    service = MapperWizardService.new
    result = service.fetch_html('')

    assert_not result[:success]
    assert_equal 'URL is required', result[:error]
  end

  test 'fetch_html returns error for nil URL' do
    service = MapperWizardService.new
    result = service.fetch_html(nil)

    assert_not result[:success]
    assert_equal 'URL is required', result[:error]
  end

  test 'fetch_html returns error for invalid URL format' do
    service = MapperWizardService.new
    result = service.fetch_html('not-a-url')

    assert_not result[:success]
    assert_equal 'Invalid URL format', result[:error]
  end

  test 'fetch_html returns error for URL without protocol' do
    service = MapperWizardService.new
    result = service.fetch_html('example.com/search')

    assert_not result[:success]
    assert_equal 'Invalid URL format', result[:error]
  end

  # NOTE: Tests that require mocking DownloadPage are skipped since we don't have
  # a mocking library configured. The fetch_html method is tested through
  # integration tests and via the DownloadPage tool tests.

  test 'fetch_html accepts http_method parameter for GET' do
    stub_request(:get, 'https://example.com/search')
      .to_return(status: 200, body: '<html>GET response</html>')

    service = MapperWizardService.new
    result = service.fetch_html('https://example.com/search', http_method: 'GET')

    assert result[:success]
    assert_predicate result[:html], :present?
  end

  test 'fetch_html accepts http_method parameter for POST with request_body' do
    stub_request(:post, 'https://example.com/search')
      .with(body: '{"query": "test"}')
      .to_return(status: 200, body: '{"results": []}')

    service = MapperWizardService.new
    result = service.fetch_html(
      'https://example.com/search',
      http_method:  'POST',
      request_body: '{"query": "test"}'
    )

    assert result[:success]
    assert_equal '{"results": []}', result[:html]
  end

  test 'fetch_html defaults to GET when http_method not specified' do
    stub_request(:get, 'https://example.com/search')
      .to_return(status: 200, body: '<html>default GET</html>')

    service = MapperWizardService.new
    result = service.fetch_html('https://example.com/search')

    assert result[:success]
    assert_predicate result[:html], :present?
  end

  test 'fetch_html POST handles connection errors' do
    stub_request(:post, 'https://example.com/search')
      .to_raise(Faraday::ConnectionFailed.new('Connection refused'))

    service = MapperWizardService.new
    result = service.fetch_html('https://example.com/search', http_method: 'POST')

    assert_not result[:success]
    assert_includes result[:error], 'Connection failed'
  end

  test 'fetch_html POST handles timeout errors' do
    stub_request(:post, 'https://example.com/search')
      .to_raise(Faraday::TimeoutError)

    service = MapperWizardService.new
    result = service.fetch_html('https://example.com/search', http_method: 'POST')

    assert_not result[:success]
    assert_equal 'Request timed out', result[:error]
  end

  test 'test_mapper returns error for blank code' do
    service = MapperWizardService.new
    result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         '',
      html_content: '<html>test</html>'
    )

    assert_not result[:success]
    assert_equal 'Code is required', result[:error]
  end

  test 'test_mapper returns error for blank HTML content' do
    service = MapperWizardService.new
    result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         'numberOfResultsMapper = function(data) { return 0; }',
      html_content: ''
    )

    assert_not result[:success]
    assert_equal 'HTML content is required', result[:error]
  end

  test 'test_mapper returns error for invalid mapper type' do
    service = MapperWizardService.new
    result = service.test_mapper(
      mapper_type:  'invalidMapper',
      code:         'someCode = function(data) { return 0; }',
      html_content: '<html>test</html>'
    )

    assert_not result[:success]
    assert_equal 'Invalid mapper type', result[:error]
  end

  test 'test_mapper executes numberOfResultsMapper successfully' do
    service = MapperWizardService.new

    code = 'numberOfResultsMapper = function(data) { return 42; }'
    result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         code,
      html_content: '<html>test</html>'
    )

    assert result[:success]
    assert_equal 42, result[:result]
  end

  test 'test_mapper executes docsMapper successfully' do
    service = MapperWizardService.new

    code = 'docsMapper = function(data) { return [{id: "1", title: "Test"}]; }'
    result = service.test_mapper(
      mapper_type:  'docsMapper',
      code:         code,
      html_content: '<html>test</html>'
    )

    assert result[:success]
    assert_equal 1, result[:result].length
    assert_equal '1', result[:result][0]['id']
    assert_equal 'Test', result[:result][0]['title']
  end

  test 'test_mapper handles JavaScript syntax errors' do
    service = MapperWizardService.new

    code = 'numberOfResultsMapper = function(data) { this is invalid }'
    result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         code,
      html_content: '<html>test</html>'
    )

    assert_not result[:success]
    assert_includes result[:error], 'JavaScript error'
  end

  test 'test_mapper handles JavaScript runtime errors' do
    service = MapperWizardService.new

    code = 'numberOfResultsMapper = function(data) { return nonexistent.value; }'
    result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         code,
      html_content: '<html>test</html>'
    )

    # Runtime errors are caught by the mapper and return 0 for numberOfResultsMapper
    assert result[:success]
    assert_equal 0, result[:result]
  end

  test 'test_mapper with real HTML parsing' do
    service = MapperWizardService.new

    html = '<html><body><p>Found 100 results</p></body></html>'
    code = <<~JS
      numberOfResultsMapper = function(data) {
        var match = data.match(/(\\d+)\\s+results/);
        return match ? parseInt(match[1]) : 0;
      }
    JS

    result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         code,
      html_content: html
    )

    assert result[:success]
    assert_equal 100, result[:result]
  end

  test 'test_mapper with docsMapper parsing HTML' do
    service = MapperWizardService.new

    html = '<html><div class="result"><a href="/doc1">Title 1</a></div><div class="result"><a href="/doc2">Title 2</a></div></html>'
    code = <<~JS
      docsMapper = function(data) {
        var docs = [];
        var blocks = data.split('<div class="result">');
        for (var i = 1; i < blocks.length; i++) {
          var urlMatch = blocks[i].match(/href="([^"]+)"/);
          var titleMatch = blocks[i].match(/>([^<]+)<\\/a>/);
          if (urlMatch && titleMatch) {
            docs.push({
              id: urlMatch[1],
              title: titleMatch[1]
            });
          }
        }
        return docs;
      }
    JS

    result = service.test_mapper(
      mapper_type:  'docsMapper',
      code:         code,
      html_content: html
    )

    assert result[:success]
    assert_equal 2, result[:result].length
    assert_equal '/doc1', result[:result][0]['id']
    assert_equal 'Title 1', result[:result][0]['title']
    assert_equal '/doc2', result[:result][1]['id']
    assert_equal 'Title 2', result[:result][1]['title']
  end

  test 'generate_mappers requires API key' do
    service = MapperWizardService.new
    result = service.generate_mappers('<html>test</html>')

    assert_not result[:success]
    assert_equal 'API key required', result[:error]
  end

  test 'generate_mappers requires HTML content' do
    service = MapperWizardService.new(api_key: 'sk-test')
    result = service.generate_mappers('')

    assert_not result[:success]
    assert_equal 'HTML content required', result[:error]
  end

  test 'refine_mapper requires API key' do
    service = MapperWizardService.new
    result = service.refine_mapper(
      mapper_type:  'numberOfResultsMapper',
      current_code: 'numberOfResultsMapper = function(data) { return 0; }',
      feedback:     'Make it better',
      html_content: '<html>test</html>'
    )

    assert_not result[:success]
    assert_equal 'API key required', result[:error]
  end

  test 'extract_single_function extracts numberOfResultsMapper' do
    service = MapperWizardService.new

    # NOTE: heredoc adds newline at start, so we need to strip or use a simple string
    code = "numberOfResultsMapper = function(data) {\n  return data.length;\n}\n\ndocsMapper = function(data) {\n  return [];\n}"

    # Use send to test private method
    result = service.send(:extract_single_function, code, 'numberOfResultsMapper')

    assert_predicate result, :present?, 'Expected to extract numberOfResultsMapper function'
    assert_includes result, 'numberOfResultsMapper', 'Expected result to include function name'
    assert_includes result, 'return data.length', 'Expected result to include return statement'
    assert_not result.include?('docsMapper'), 'Expected result to not include docsMapper'
  end

  test 'extract_single_function extracts docsMapper' do
    service = MapperWizardService.new

    code = "numberOfResultsMapper = function(data) {\n  return 0;\n}\n\ndocsMapper = function(data) {\n  var docs = [];\n  return docs;\n}"

    result = service.send(:extract_single_function, code, 'docsMapper')

    assert_predicate result, :present?, 'Expected to extract docsMapper function'
    assert_includes result, 'docsMapper', 'Expected result to include function name'
    assert_includes result, 'var docs = []', 'Expected result to include var docs'
    assert_not result.include?('numberOfResultsMapper'), 'Expected result to not include numberOfResultsMapper'
  end

  test 'extract_single_function returns nil for missing function' do
    service = MapperWizardService.new

    code = "someOtherFunction = function(data) {\n  return 0;\n}"

    result = service.send(:extract_single_function, code, 'numberOfResultsMapper')

    assert_nil result
  end

  test 'extract_functions_from_response extracts both functions from separate code blocks' do
    service = MapperWizardService.new

    # Build the markdown content with explicit newlines to ensure proper parsing
    content = "Here are the mapper functions:\n\n```javascript\nnumberOfResultsMapper = function(data) {\n  return 42;\n}\n```\n\n```javascript\ndocsMapper = function(data) {\n  return [{id: \"1\", title: \"Test\"}];\n}\n```"

    result = service.send(:extract_functions_from_response, content)

    assert result[:success], "Expected success but got: #{result[:error]}"
    assert_predicate result[:number_of_results_mapper], :present?, 'Expected number_of_results_mapper to be present'
    assert_predicate result[:docs_mapper], :present?, 'Expected docs_mapper to be present'
    assert_includes result[:number_of_results_mapper], 'numberOfResultsMapper'
    assert_includes result[:docs_mapper], 'docsMapper'
  end

  test 'extract_functions_from_response handles combined code block' do
    service = MapperWizardService.new

    content = "Here are the mapper functions:\n\n```javascript\nnumberOfResultsMapper = function(data) {\n  return 42;\n}\n\ndocsMapper = function(data) {\n  return [];\n}\n```"

    result = service.send(:extract_functions_from_response, content)

    assert result[:success], "Expected success but got: #{result[:error]}"
    assert_predicate result[:number_of_results_mapper], :present?, 'Expected number_of_results_mapper to be present'
    assert_predicate result[:docs_mapper], :present?, 'Expected docs_mapper to be present'
  end

  test 'extract_functions_from_response returns error when no code found' do
    service = MapperWizardService.new

    content = 'Here is some text without any code blocks.'

    result = service.send(:extract_functions_from_response, content)

    assert_not result[:success]
    assert_equal 'No JavaScript code found in response', result[:error]
  end
end
