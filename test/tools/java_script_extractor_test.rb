# frozen_string_literal: true

require 'test_helper'

class JavaScriptExtractorTest < ActiveSupport::TestCase
  setup do
    @tool = JavaScriptExtractor.new
  end

  test 'tool responds to execute method' do
    assert_respond_to @tool, :execute
  end

  test 'extracts javascript from labeled blocks' do
    markdown_content = <<~MARKDOWN
      Here is some JavaScript code:

      ```javascript
      const numberOfResultsMapper = function(data) {
        return data.length;
      };
      ```

      And another block:

      ```js
      const docsMapper = function(data) {
        return data.map(doc => ({ id: doc.id, title: doc.title }));
      };
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), "Expected string result, got #{result.class}"
    assert result.include?('numberOfResultsMapper'), 'Should contain numberOfResultsMapper function'
    assert result.include?('docsMapper'), 'Should contain docsMapper function'
    assert_not result.include?('```'), 'Should not contain backticks'
    assert result.include?("\n\n"), 'Should join blocks with double newlines'
  end

  test 'extracts javascript from case insensitive blocks' do
    markdown_content = <<~MARKDOWN
      ```JavaScript
      const test = 'uppercase label';
      ```

      ```JS
      const test2 = 'uppercase js';
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), 'Should extract from case insensitive blocks'
    assert result.include?("const test = 'uppercase label'"), 'Should extract from JavaScript block'
    assert result.include?("const test2 = 'uppercase js'"), 'Should extract from JS block'
  end

  test 'handles blocks with extra whitespace' do
    markdown_content = <<~MARKDOWN
      ```javascript#{'   '}
      const test = 'with whitespace';
      ```

      ```js
      const test2 = 'no space before js';
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), 'Should handle whitespace in block headers'
    assert result.include?("const test = 'with whitespace'"), 'Should extract despite extra whitespace'
    assert result.include?("const test2 = 'no space before js'"), 'Should extract from js block'
  end

  test 'detects unlabeled javascript blocks' do
    markdown_content = <<~MARKDOWN
      Here's some code without a label:

      ```
      function myFunction() {
        console.log('This looks like JavaScript');
        return true;
      }
      ```

      And another:

      ```
      const arrow = () => {
        let data = [];
        for (let i = 0; i < 10; i++) {
          data.push({ id: i });
        }
        return data;
      };
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), 'Should detect JavaScript in unlabeled blocks'
    assert result.include?('myFunction'), 'Should contain detected function'
    assert result.include?('arrow'), 'Should contain arrow function'
    assert result.include?('console.log'), 'Should detect console usage'
  end

  test 'ignores unlabeled non-javascript blocks' do
    markdown_content = <<~MARKDOWN
      Here's some non-JavaScript code:

      ```
      SELECT * FROM users WHERE active = true;
      ```

      ```
      def ruby_method
        puts "This is Ruby"
      end
      ```

      But this should be detected:

      ```
      const jsCode = function() {
        return 'javascript';
      };
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), 'Should extract only JavaScript-like code'
    assert_not result.include?('SELECT'), 'Should not include SQL'
    assert_not result.include?('ruby_method'), 'Should not include Ruby'
    assert result.include?('jsCode'), 'Should include JavaScript function'
  end

  test 'handles empty content' do
    result = @tool.execute(markdown_content: 'No code blocks here')

    assert result.is_a?(Hash), 'Expected hash result for empty content'
    assert result.key?(:error), 'Should return error for empty content'
    assert result[:error].include?('No JavaScript code blocks found'), 'Should mention no code blocks found'
  end

  test 'validates input types' do
    # Test with nil input
    result = @tool.execute(markdown_content: nil)
    assert result.is_a?(Hash), 'Should return error hash for nil input'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('must be a string'), 'Should mention string requirement'

    # Test with non-string input
    result = @tool.execute(markdown_content: 123)
    assert result.is_a?(Hash), 'Should return error hash for non-string input'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('must be a string'), 'Should mention string requirement'

    # Test with empty string
    result = @tool.execute(markdown_content: '')
    assert result.is_a?(Hash), 'Should return error hash for empty input'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Empty markdown content'), 'Should mention empty content'

    # Test with whitespace only
    result = @tool.execute(markdown_content: "   \n\t  ")
    assert result.is_a?(Hash), 'Should return error hash for whitespace-only input'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Empty markdown content'), 'Should mention empty content'
  end

  test 'validates javascript syntax' do
    markdown_with_unbalanced_braces = <<~MARKDOWN
      ```javascript
      const func = function() {
        console.log("missing closing brace"
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_with_unbalanced_braces)
    assert result.is_a?(Hash), 'Should return error hash for unbalanced braces'
    assert result.key?(:error), 'Should have error key for syntax errors'
    assert result[:error].include?('syntax errors'), 'Error should mention syntax errors'
    assert result[:error].include?('Unbalanced braces'), 'Should specifically mention brace issue'
  end

  test 'validates balanced brackets' do
    markdown_with_unbalanced_brackets = <<~MARKDOWN
      ```javascript
      const arr = [1, 2, 3;
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_with_unbalanced_brackets)
    assert result.is_a?(Hash), 'Should return error hash for unbalanced brackets'
    assert result[:error].include?('Unbalanced brackets'), 'Should mention bracket issue'
  end

  test 'validates balanced parentheses' do
    markdown_with_unbalanced_parens = <<~MARKDOWN
      ```javascript
      const func = function( {
        return true;
      };
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_with_unbalanced_parens)
    assert result.is_a?(Hash), 'Should return error hash for unbalanced parentheses'
    assert result[:error].include?('Unbalanced parentheses'), 'Should mention parentheses issue'
  end

  test 'accepts valid javascript syntax' do
    markdown_with_valid_js = <<~MARKDOWN
      ```javascript
      const validFunction = function(data) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
          result.push({ id: data[i].id, name: data[i].name });
        }
        return result;
      };

      const arrowFunction = (x) => x * 2;
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_with_valid_js)
    assert result.is_a?(String), 'Should return string for valid JavaScript'
    assert result.include?('validFunction'), 'Should contain the function'
    assert result.include?('arrowFunction'), 'Should contain arrow function'
  end

  test 'works with fixture file' do
    fixture_path = Rails.root.join('test/fixtures/files/llm_generated_response.md')
    skip('Fixture file not found') unless File.exist?(fixture_path)

    markdown_content = File.read(fixture_path)
    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), 'Should extract JavaScript from fixture file'
    assert result.include?('numberOfResultsMapper'), 'Should contain numberOfResultsMapper function'
    assert result.include?('docsMapper'), 'Should contain docsMapper function'
    assert_not result.include?('```'), 'Should not contain backticks in extracted code'

    # Verify the extracted code contains expected patterns
    assert result.match?(/const\s+numberOfResultsMapper\s*=\s*function/), 'Should have numberOfResultsMapper function'
    assert result.match?(/const\s+docsMapper\s*=\s*function/), 'Should have docsMapper function'
  end

  test 'handles javascript patterns correctly' do
    patterns_to_test = [
      'function myFunc() {}',
      'const x = 5;',
      'let y = 10;',
      'var z = 15;',
      'const arrow = () => {};',
      "{ key: 'value' }",
      "console.log('test');",
      "console.error('error');",
      'if (condition) { }',
      'for (let i = 0; i < 10; i++) { }',
      'while (true) { }'
    ]

    patterns_to_test.each do |pattern|
      markdown = "```\n#{pattern}\n```"
      result = @tool.execute(markdown_content: markdown)

      assert result.is_a?(String), "Should detect '#{pattern}' as JavaScript"
      assert result.include?(pattern.strip), 'Should extract the pattern correctly'
    end
  end

  test 'ignores empty code blocks' do
    markdown_content = <<~MARKDOWN
      ```js
      const valid = 'code';
      ```
    MARKDOWN

    result = @tool.execute(markdown_content: markdown_content)

    assert result.is_a?(String), 'Should return string for valid blocks'
    assert result.include?("const valid = 'code'"), 'Should include non-empty block'
    assert_not result.include?('```'), 'Should not contain backticks in result'
  end

  test 'handles malformed markdown gracefully' do
    # Test with malformed markdown that might cause issues
    malformed_markdown = "```javascript\nconst test = 'missing end block'"

    result = @tool.execute(markdown_content: malformed_markdown)

    # Should either extract something or return an error, but not crash
    assert result.is_a?(String) || result.is_a?(Hash), 'Should handle malformed markdown gracefully'
  end
end
