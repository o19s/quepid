# frozen_string_literal: true

class V8MapperExecutor
  class MapperError < StandardError; end

  attr_reader :logs

  # rubocop:disable Metrics/MethodLength
  def initialize js_file_path
    @context = MiniRacer::Context.new
    @logs = []

    # Add Ruby methods to JavaScript context
    attach_ruby_methods

    # Add console.log support that captures to @logs
    @context.eval <<-JS
      var console = {
        log: function() {
          var args = Array.prototype.slice.call(arguments);
          var message = args.map(function(arg) {
            if (typeof arg === 'object') {
              try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
          }).join(' ');
          captureLog('log', message);
        },
        error: function() {
          var args = Array.prototype.slice.call(arguments);
          var message = args.map(function(arg) {
            if (typeof arg === 'object') {
              try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
          }).join(' ');
          captureLog('error', message);
        },
        warn: function() {
          var args = Array.prototype.slice.call(arguments);
          var message = args.map(function(arg) {
            if (typeof arg === 'object') {
              try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
          }).join(' ');
          captureLog('warn', message);
        },
        info: function() {
          var args = Array.prototype.slice.call(arguments);
          var message = args.map(function(arg) {
            if (typeof arg === 'object') {
              try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
          }).join(' ');
          captureLog('info', message);
        }
      };
    JS

    # Load your code_mapper JavaScript
    @context.eval(File.read(js_file_path))
  end
  # rubocop:enable Metrics/MethodLength

  def clear_logs
    @logs = []
  end

  # rubocop:disable Style/DocumentDynamicEvalDefinition
  def extract_docs code_mapper, response_body
    @context.eval('var docs = [];')

    @context.eval(code_mapper)

    @context.eval('validateMappersExist()')

    response_body = response_body.join("\n") if response_body.is_a?(Array)

    # If responseBody is a JSON string, parse it first before converting to JavaScript
    if response_body.is_a?(String)
      begin
        parsed_body = JSON.parse(response_body)
        @context.eval("var responseBody = #{parsed_body.to_json};")
      rescue JSON::ParserError
        # If it's not valid JSON, treat it as a plain string
        @context.eval("var responseBody = #{response_body.to_json};")
      end
    else
      @context.eval("var responseBody = #{response_body.to_json};")
    end

    @context.eval <<-JS
      try {
        docs = docsMapper(responseBody); // Your JavaScript document mapping function
      } catch (error) {
        console.error('docsMapper error:', error.message);
        ({ error: error.message });
      }
    JS

    docs = @context.eval('docs')
    docs
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end
  # rubocop:enable Style/DocumentDynamicEvalDefinition

  # rubocop:disable Style/DocumentDynamicEvalDefinition
  def extract_number_of_results code_mapper, response_body
    @context.eval('var numberOfResults = 0;')

    @context.eval(code_mapper)

    @context.eval('validateMappersExist()')

    response_body = response_body.join("\n") if response_body.is_a?(Array)

    # If responseBody is a JSON string, parse it first before converting to JavaScript
    begin   
      parsed_body = JSON.parse(response_body)
      @context.eval("var responseBody = #{parsed_body.to_json};")
    rescue JSON::ParserError
      # If it's not valid JSON, treat it as a plain string
      @context.eval("var responseBody = #{response_body.to_json};")
    end

    @context.eval <<-JS
      try {
        numberOfResults = numberOfResultsMapper(responseBody);
      } catch (error) {
        console.error('numberOfResultsMapper error:', error.message);
        numberOfResults = 0;
      }
    JS

    number_of_results = @context.eval('numberOfResults')
    number_of_results
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end
  # rubocop:enable Style/DocumentDynamicEvalDefinition

  private

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
