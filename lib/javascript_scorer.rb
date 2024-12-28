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
  def score docs, best_docs, scorer_code
    scorer_code << "\ngetScore()" # method that returns the score in eval context
    @context.eval("docs = #{docs.to_json};")
    @context.eval("bestDocs = #{best_docs.to_json};")

    result = @context.eval(scorer_code)
    puts "the result is #{result}"
    raise ScoreError, result['error'] if result.is_a?(Hash) && result['error']

    smart_round(result)
  rescue MiniRacer::Error => e
    raise ScoreError, "JavaScript execution error: #{e.message}"
  end

  # rubocop enable Metrics/MethodLength
  # rubocop:enable Style/DocumentDynamicEvalDefinition
  # rubocop:disable Style/DocumentDynamicEvalDefinition
  # demo method!
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

  def format_number number
    format('%.2f', number.to_f).sub(/\.?0+$/, '')
  end

  def smart_round number
    # If the number has 2 or more decimal places, round to 2
    decimal_places = begin
      number.to_s.split('.').last.length
    rescue StandardError
      0
    end
    if decimal_places >= 2
      number.round(2)
    else
      number # Keep the number as is
    end
  end
end
