# frozen_string_literal: true

class JavascriptScorer
  class ScoreError < StandardError; end

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

    # Load your scoring JavaScript
    @context.eval(File.read(js_file_path))
  end

  # rubocop disable Metrics/MethodLength
  # rubocop:disable Style/DocumentDynamicEvalDefinition
  def score docs, scorer_code
    @context.eval("docs = #{docs.to_json};")

    result = @context.eval(scorer_code)
    puts "the result is #{result}"
    raise ScoreError, result['error'] if result.is_a?(Hash) && result['error']

    result
  rescue MiniRacer::Error => e
    raise ScoreError, "JavaScript execution error: #{e.message}"
  end

  # rubocop enable Metrics/MethodLength
  # rubocop:enable Style/DocumentDynamicEvalDefinition
  # rubocop:disable Style/DocumentDynamicEvalDefinition
  def score_items items, options = {}
    # Convert Ruby objects and options to JavaScript
    js_items = items.to_json
    js_options = options.to_json

    result = @context.eval(<<-JS)
        try {
          const items = #{js_items};
          const options = #{js_options};
          scoreItems(items, options);  // Your JavaScript scoring function
        } catch (error) {
          ({ error: error.message });
        }
    JS

    raise ScoreError, result['error'] if result.is_a?(Hash) && result['error']

    result
  rescue MiniRacer::Error => e
    raise ScoreError, "JavaScript execution error: #{e.message}"
  end
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
