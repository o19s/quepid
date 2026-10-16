# frozen_string_literal: true

class V8MapperExecutor
  class MapperError < StandardError; end

  attr_reader :logs

  def initialize js_file_path
    @context = MiniRacer::Context.new
    @logs = []

    # Add Ruby methods to JavaScript context
    attach_ruby_methods

    # Add console.log support that captures to @logs
    @context.eval <<-JS
      var console = (function() {
        function formatArgument(arg) {
          if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch(e) { return String(arg); }
          }
          return String(arg);
        }
        function logger(level) {
          return function() {
            var args = Array.prototype.slice.call(arguments);
            captureLog(level, args.map(formatArgument).join(' '));
          };
        }
        return {
          log: logger('log'),
          error: logger('error'),
          warn: logger('warn'),
          info: logger('info')
        };
      })();
    JS

    # Load your code_mapper JavaScript
    @context.eval(File.read(js_file_path))
  end

  def clear_logs
    @logs = []
  end

  def extract_docs code_mapper, response_body
    @context.eval('var docs = [];')

    @context.eval(code_mapper)

    @context.eval('validateMappersExist()')

    load_response_body(response_body)

    # Let a thrown docsMapper error propagate as a MiniRacer::Error (caught below) rather
    # than swallowing it here - callers need to distinguish "the mapper crashed" from
    # "the mapper legitimately found zero docs".
    @context.eval('docs = docsMapper(responseBody);')

    docs = @context.eval('docs')
    docs
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end

  def extract_number_of_results code_mapper, response_body
    @context.eval('var numberOfResults = 0;')

    @context.eval(code_mapper)

    @context.eval('validateMappersExist()')

    load_response_body(response_body)

    # See the matching comment in extract_docs: let a thrown error propagate instead of
    # silently defaulting numberOfResults to 0, which would be indistinguishable from a
    # legitimate zero-result query.
    @context.eval('numberOfResults = numberOfResultsMapper(responseBody);')

    number_of_results = @context.eval('numberOfResults')
    number_of_results
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end

  private

  def load_response_body response_body
    response_body = response_body.join("\n") if response_body.is_a?(Array)
    if response_body.is_a?(String)
      begin
        response_body = JSON.parse(response_body)
      rescue JSON::ParserError
        # Non-JSON responses (including HTML) retain their string contract.
      end
    end
    # rubocop:disable-next Style/DocumentDynamicEvalDefinition
    @context.eval("var responseBody = #{response_body.to_json};")
    # Preserve object/array access while supporting saved JSON.parse(data) mappers.
    # The non-enumerable coercion hook leaves keys and JSON serialization intact;
    # no native JSON functions are replaced and mapper errors are never retried.
    @context.eval <<~JS
      if (responseBody !== null && typeof responseBody === 'object') {
        Object.defineProperty(responseBody, Symbol.toPrimitive, {
          value: function() { return JSON.stringify(this); }
        });
      }
    JS
  end

  def attach_ruby_methods
    # Capture log messages to @logs array
    @context.attach('captureLog', ->(level, message) {
      @logs << { level: level, message: message, timestamp: Time.current.iso8601 }
      # Also write to server console for debugging
      # puts "[JS #{level.upcase}] #{message}"
    })

    # Legacy puts support
    @context.attach('puts', ->(message) {
      @logs << { level: 'log', message: message.to_s, timestamp: Time.current.iso8601 }
      puts message
    })

    # Expose Ruby methods to JavaScript
    # Think about if I sill need rubyLog when I can write to the server with console.log.
    @context.attach('rubyLog', ->(message) {
      @logs << { level: 'log', message: message.to_s, timestamp: Time.current.iso8601 }
      puts(message)
    })

    # Add more Ruby methods as needed.  This is an example of a notional method.
    @context.attach('fetchData', ->(id) {
      Data.find(id).to_json
    })
  end
end
