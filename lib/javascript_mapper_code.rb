# frozen_string_literal: true

class JavascriptMapperCode
  class MapperError < StandardError; end

  def initialize js_file_path
    @context = MiniRacer::Context.new

    # Add Ruby methods to JavaScript context
    attach_ruby_methods

    # Add console.log support
    @context.eval <<-JS
      var console = {
        log: function(msg) { puts(msg); }
      };
    JS

    # Load your code_mapper JavaScript
    @context.eval(File.read(js_file_path))
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Style/DocumentDynamicEvalDefinition
  def extract_docs code_mapper, response_body
    @context.eval('var docs = [];')

    @context.eval(code_mapper)

    @context.eval('validateMappersExist()')

    puts "response_body: #{response_body.is_a?(Array)}"
    response_body = response_body.join("\n") if response_body.is_a?(Array)
    puts "and the boy is: #{response_body}"

    @context.eval("var responseBody = #{response_body.to_json};")

    @context.eval <<-JS
      try {
        docs = docsMapper(responseBody); // Your JavaScript document mapping function
      } catch (error) {
        ({ error: error.message });
      }
    JS

    docs = @context.eval('docs')
    docs
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Style/DocumentDynamicEvalDefinition

  private

  def attach_ruby_methods
    @context.attach('puts', ->(message) { puts message })

    # Expose Ruby methods to JavaScript
    @context.attach('rubyLog', ->(message) { puts(message) })

    # Add more Ruby methods as needed
    @context.attach('fetchData', ->(id) {
      Data.find(id).to_json
    })
  end
end
