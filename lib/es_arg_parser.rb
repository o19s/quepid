# frozen_string_literal: true

require 'json'

module EsArgParser
  def self.parse query_string, vars = {}
    # Remove new line characters
    json_string = query_string.gsub(/\\n/, '').gsub(/\\r/, '').gsub(/%/, '%%')

    # Ready string to accept curator vars
    converted_string = json_string.clone
    vars.each { |key, _value| converted_string.gsub!(format('##%s##', key), "%{#{key}}") }

    # Interpolate curator vars
    converted_string = converted_string % vars if converted_string != json_string

    # If there are any remaining escaped `%`, unescape them
    converted_string.gsub!(/%%/, '%')

    # Parse the JSON string
    # rubocop:disable Style/RedundantReturn
    begin
      return JSON.parse(converted_string)
    rescue JSON::ParserError
      return nil
    end
    # rubocop:enable Style/RedundantReturn
  end
end
