# frozen_string_literal: true

class JavascriptExtractor < RubyLLM::Tool
  description 'Extracts JavaScript code blocks from markdown content'
  param :markdown_content, desc: 'Markdown content string containing JavaScript code blocks'

  def execute markdown_content:
    # Validate input
    return { error: 'Invalid input: markdown_content must be a string' } unless markdown_content.is_a?(String)

    return { error: 'Empty markdown content provided' } if markdown_content.strip.empty?

    # Extract JavaScript code blocks using regex
    javascript_blocks = extract_javascript_blocks(markdown_content)

    if javascript_blocks.empty?
      { error: 'No JavaScript code blocks found in the markdown content' }
    else
      # Validate extracted JavaScript syntax
      combined_js = javascript_blocks.join("\n\n")
      validation_result = validate_javascript_syntax(combined_js)

      if validation_result[:valid]
        combined_js
      else
        { error: "Extracted JavaScript contains syntax errors: #{validation_result[:error]}" }
      end
    end
  rescue StandardError => e
    { error: e.message }
  end

  private

  def extract_javascript_blocks content
    # Match code blocks that are either ```javascript or just ```
    # This regex captures the content between the backticks
    javascript_blocks = []

    # Match ```javascript ... ``` blocks (case insensitive)
    content.scan(/```javascript\s*\n(.*?)\n```/mi) do |match|
      code = match[0].strip
      javascript_blocks << code unless code.empty?
    end

    # Match ```js ... ``` blocks (case insensitive)
    content.scan(/```js\s*\n(.*?)\n```/mi) do |match|
      code = match[0].strip
      javascript_blocks << code unless code.empty?
    end

    # If no labeled blocks found, try unlabeled ``` blocks that contain JavaScript-like content
    if javascript_blocks.empty?
      content.scan(/```\s*\n(.*?)\n```/m) do |match|
        code = match[0].strip
        next if code.empty?

        # Enhanced heuristic for JavaScript detection
        js_patterns = [
          /(function\s*[\w$]*\s*\()/,           # function declarations
          /(const\s+\w+\s*=)/,                  # const declarations
          /(let\s+\w+\s*=)/,                    # let declarations
          /(var\s+\w+\s*=)/,                    # var declarations
          /(\w+\s*=>\s*)/,                      # arrow functions
          /(\{\s*[\w$]+\s*:)/,                  # object literals
          /(console\.(log|error|warn|info))/,   # console methods
          /(if\s*\(.*\)\s*\{)/,                # if statements
          /(for\s*\(.*\)\s*\{)/,               # for loops
          /(while\s*\(.*\)\s*\{)/              # while loops
        ]

        javascript_blocks << code if js_patterns.any? { |pattern| code.match?(pattern) }
      end
    end

    javascript_blocks
  end

  def validate_javascript_syntax code
    # Basic syntax validation
    return { valid: false, error: 'Empty code' } if code.strip.empty?

    # Check for balanced braces, brackets, and parentheses
    braces = code.scan(/[{}]/)
    brackets = code.scan(/[\[\]]/)
    parens = code.scan(/[()]/)

    brace_balance = braces.count('{') - braces.count('}')
    bracket_balance = brackets.count('[') - brackets.count(']')
    paren_balance = parens.count('(') - parens.count(')')

    unless brace_balance.zero?
      return { valid: false, error: "Unbalanced braces (#{brace_balance.positive? ? 'missing' : 'extra'} closing brace)" }
    end

    unless bracket_balance.zero?
      return { valid: false, error: "Unbalanced brackets (#{bracket_balance.positive? ? 'missing' : 'extra'} closing bracket)" }
    end

    unless paren_balance.zero?
      return { valid: false, error: "Unbalanced parentheses (#{paren_balance.positive? ? 'missing' : 'extra'} closing parenthesis)" }
    end

    { valid: true }
  rescue StandardError => e
    { valid: false, error: e.message }
  end
end
