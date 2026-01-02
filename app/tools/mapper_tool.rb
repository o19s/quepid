# frozen_string_literal: true

require 'v8_mapper_executor'

class MapperTool < RubyLLM::Tool
  description 'Executes JavaScript mapper functions against HTML content using the V8MapperExecutor class'
  param :javascript_code, desc: 'JavaScript code containing numberOfResultsMapper and docsMapper functions'
  param :html_content, desc: 'HTML content to be processed by the JavaScript functions'

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def execute javascript_code:, html_content:
    puts '=' * 60
    puts 'MAPPER TOOL INVOKED BY LLM'
    puts 'Tool: MapperTool (app/tools/mapper_tool.rb)'
    puts "Timestamp: #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}"
    puts "JavaScript code length: #{javascript_code&.length || 0} characters"
    puts "HTML content length: #{html_content&.length || 0} characters"
    puts '=' * 60

    # Validate inputs
    return { error: 'Invalid input: javascript_code must be a string' } unless javascript_code.is_a?(String)
    return { error: 'Invalid input: html_content must be a string' } unless html_content.is_a?(String)
    return { error: 'Empty JavaScript code provided' } if javascript_code.strip.empty?
    return { error: 'Empty HTML content provided' } if html_content.strip.empty?

    # Initialize the JavaScript mapper with the mapper logic file
    mapper_code_file = Rails.root.join('lib/mapper_code_logic.js')
    return { error: 'Mapper code logic file not found' } unless File.exist?(mapper_code_file)

    executor = V8MapperExecutor.new(mapper_code_file)

    # Execute the JavaScript functions against the HTML content
    puts 'EXECUTING: docsMapper function via V8MapperExecutor...'
    documents = executor.extract_docs(javascript_code, html_content)
    puts 'EXECUTING: numberOfResultsMapper function via V8MapperExecutor...'
    results_count = executor.extract_number_of_results(javascript_code, html_content)

    # Return the processed data
    puts 'MAPPER TOOL COMPLETED SUCCESSFULLY!'
    puts "Documents extracted: #{documents.is_a?(Array) ? documents.length : 0}"
    puts "Total results counted: #{results_count}"
    puts 'Tool execution finished - returning data to LLM'
    puts '=' * 60

    {
      success:        true,
      documents:      documents,
      document_count: documents.is_a?(Array) ? documents.length : 0,
      total_results:  results_count,
    }
  rescue V8MapperExecutor::MapperError => e
    puts "MAPPER TOOL FAILED - Mapper Error: #{e.message}"
    puts '=' * 60
    { error: "JavaScript mapper error: #{e.message}" }
  rescue StandardError => e
    puts "MAPPER TOOL FAILED - Unexpected Error: #{e.message}"
    puts '=' * 60
    { error: "Unexpected error: #{e.message}" }
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
end
