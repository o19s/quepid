# frozen_string_literal: true

require 'test_helper'

# Test specifically for the MapperTool functionality
class MapperToolTest < ActionDispatch::IntegrationTest
  test 'MapperTool executes successfully with valid input' do
    tool = MapperTool.new

    javascript_code = <<~JS
      numberOfResultsMapper = function(data) {
        // Simple test - just return 42
        return 42;
      };

      docsMapper = function(data) {
        // Parse some fake data from the HTML
        return [
          { id: 1, title: "First Document", url: "http://example.com/1" },
          { id: 2, title: "Second Document", url: "http://example.com/2" },
          { id: 3, title: "Third Document", url: "http://example.com/3" }
        ];
      };
    JS

    html_content = '<html><body><h1>Test Page</h1><p>Some content</p></body></html>'

    result = tool.execute(javascript_code: javascript_code, html_content: html_content)

    assert result[:success], 'Tool should execute successfully'
    assert_equal 3, result[:document_count], 'Should return 3 documents'
    assert_equal 42, result[:total_results], 'Should return 42 total results'
    assert_kind_of Array, result[:documents], 'Documents should be an array'
    assert_equal 'First Document', result[:documents].first['title'], 'First document title should match'
  end

  test 'MapperTool handles missing functions gracefully' do
    tool = MapperTool.new

    # JavaScript code missing required functions
    javascript_code = <<~JS
      // Missing both numberOfResultsMapper and docsMapper
      var someOtherFunction = function() {
        return "hello";
      };
    JS

    html_content = '<html><body>Test</body></html>'

    result = tool.execute(javascript_code: javascript_code, html_content: html_content)

    assert result.key?(:error), 'Should return an error'
    assert_includes result[:error], 'JavaScript mapper error', 'Should indicate mapper error'
  end

  test 'MapperTool validates input parameters' do
    tool = MapperTool.new

    # Test with nil javascript_code
    result = tool.execute(javascript_code: nil, html_content: '<html></html>')
    assert result.key?(:error), 'Should return error for nil javascript_code'
    assert_includes result[:error], 'javascript_code must be a string'

    # Test with nil html_content
    result = tool.execute(javascript_code: 'var x = 1;', html_content: nil)
    assert result.key?(:error), 'Should return error for nil html_content'
    assert_includes result[:error], 'html_content must be a string'

    # Test with empty strings
    result = tool.execute(javascript_code: '', html_content: '<html></html>')
    assert result.key?(:error), 'Should return error for empty javascript_code'
    assert_includes result[:error], 'Empty JavaScript code provided'

    result = tool.execute(javascript_code: 'var x = 1;', html_content: '')
    assert result.key?(:error), 'Should return error for empty html_content'
    assert_includes result[:error], 'Empty HTML content provided'
  end

  test 'MapperTool handles JavaScript execution errors' do
    tool = MapperTool.new

    # JavaScript code with syntax errors
    javascript_code = <<~JS
      numberOfResultsMapper = function(data) {
        // Syntax error - missing closing brace
        return data.length

      docsMapper = function(data) {
        return [];
      };
    JS

    html_content = '<html><body>Test</body></html>'

    result = tool.execute(javascript_code: javascript_code, html_content: html_content)

    assert result.key?(:error), 'Should return an error for syntax errors'
    assert result[:error].include?('JavaScript mapper error') || result[:error].include?('Unexpected error'),
           'Should indicate JavaScript-related error'
  end

  test 'MapperTool works with realistic HTML parsing' do
    tool = MapperTool.new

    # More realistic JavaScript that actually parses HTML
    javascript_code = <<~JS
      numberOfResultsMapper = function(data) {
        // Simple string counting approach
        var resultCount = 0;
        var searchIndex = 0;
        while (true) {
          var foundIndex = data.indexOf('<div class="result"', searchIndex);
          if (foundIndex === -1) break;
          resultCount++;
          searchIndex = foundIndex + 1;
        }
        return resultCount;
      };

      docsMapper = function(data) {
        var docs = [];
      #{' ' * 2}
        // Split by div class="result" and process each section
        var parts = data.split('<div class="result"');
      #{' ' * 2}
        for (var i = 1; i < parts.length; i++) {
          var content = parts[i];
      #{' ' * 4}
          // Extract URL first
          var aStart = content.indexOf('<a href="');
          var url = '';
          if (aStart !== -1) {
            var aEnd = content.indexOf('"', aStart + 9);
            if (aEnd !== -1) {
              url = content.substring(aStart + 9, aEnd);
            }
          }
      #{' ' * 4}
          // Extract title - look for text between <a> tags
          var linkStart = content.indexOf('<a href="');
          if (linkStart !== -1) {
            var linkClose = content.indexOf('>', linkStart);
            var linkEnd = content.indexOf('</a>', linkClose);
      #{' ' * 6}
            if (linkClose !== -1 && linkEnd !== -1) {
              var title = content.substring(linkClose + 1, linkEnd);
      #{' ' * 8}
              var doc = {
                id: i,
                title: title
              };
      #{' ' * 8}
              if (url) {
                doc.url = url;
              }
      #{' ' * 8}
              docs.push(doc);
            }
          }
        }
      #{' ' * 2}
        return docs;
      };
    JS

    html_content = <<~HTML
      <html>
        <body>
          <div class="result">
            <h3><a href="http://example.com/1">First Result</a></h3>
            <p>Description of first result</p>
          </div>
          <div class="result">
            <h3><a href="http://example.com/2">Second Result</a></h3>
            <p>Description of second result</p>
          </div>
          <div class="result">
            <h3><a href="http://example.com/3">Third Result</a></h3>
            <p>Description of third result</p>
          </div>
        </body>
      </html>
    HTML

    result = tool.execute(javascript_code: javascript_code, html_content: html_content)

    assert result[:success], 'Tool should execute successfully'
    assert_equal 3, result[:document_count], 'Should find 3 documents'
    assert_equal 3, result[:total_results], 'Should find 3 total results'

    # Check first document
    first_doc = result[:documents].first
    assert_equal 'First Result', first_doc['title'], 'Should extract title correctly'
    assert_equal 'http://example.com/1', first_doc['url'], 'Should extract URL correctly'
  end
end
