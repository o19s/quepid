# frozen_string_literal: true

class V8MapperExecutor
  class MapperError < StandardError; end

  # Mapper globals a code_mapper may optionally define, unlike docsMapper/numberOfResultsMapper
  # (which validateMappersExist requires every mapper to define, so each call's eval always
  # overwrites them). @context is one persistent MiniRacer::Context reused across every mapper
  # call for a run (FetchService builds one V8MapperExecutor for the whole batch), so an
  # optional global a previous call's mapper defined would otherwise leak into a later call
  # whose mapper doesn't define it - reset before every eval of code_mapper closes that gap.
  OPTIONAL_MAPPER_GLOBALS = %w[requestArgsMapper].freeze

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

  # rubocop:disable-next Style/DocumentDynamicEvalDefinition
  def extract_docs code_mapper, response_body
    @context.eval('var docs = [];')

    reset_optional_mapper_globals
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

    # Let a thrown docsMapper error propagate as a MiniRacer::Error (caught below) rather
    # than swallowing it here - callers need to distinguish "the mapper crashed" from
    # "the mapper legitimately found zero docs".
    @context.eval('docs = docsMapper(responseBody);')

    docs = @context.eval('docs')
    docs
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end

  # rubocop:disable-next Style/DocumentDynamicEvalDefinition
  def extract_number_of_results code_mapper, response_body
    @context.eval('var numberOfResults = 0;')

    reset_optional_mapper_globals
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

    # See the matching comment in extract_docs: let a thrown error propagate instead of
    # silently defaulting numberOfResults to 0, which would be indistinguishable from a
    # legitimate zero-result query.
    @context.eval('numberOfResults = numberOfResultsMapper(responseBody);')

    number_of_results = @context.eval('numberOfResults')
    number_of_results
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end

  # requestArgsMapper is optional (most mappers, e.g. Vespa, don't need to shape the outgoing
  # request themselves) and isn't covered by validateMappersExist, so args is returned
  # untouched when the mapper doesn't define one - unlike extract_docs/extract_number_of_results
  # above, which require their mapper function to exist.
  # rubocop:disable-next Style/DocumentDynamicEvalDefinition
  def apply_request_args_mapper code_mapper, args, number_of_rows
    reset_optional_mapper_globals
    @context.eval(code_mapper)

    return args if 'undefined' == @context.eval('typeof requestArgsMapper')

    @context.eval("requestArgsMapper(#{args.to_json}, #{number_of_rows.to_json});")
  rescue MiniRacer::Error => e
    raise MapperError, "JavaScript execution error: #{e.message}"
  end

  private

  # rubocop:disable-next Style/DocumentDynamicEvalDefinition
  def reset_optional_mapper_globals
    OPTIONAL_MAPPER_GLOBALS.each { |name| @context.eval("#{name} = undefined;") }
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
