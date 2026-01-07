# frozen_string_literal: true

module SolrArgParser
  def self.parse query_string, vars = {}
    # join lines, remove extraneous whitespace
    # rubocop:disable Style/RedundantArgument
    query_string = '' if query_string.nil?
    query_string = query_string.lines.map(&:strip).join('')
    # rubocop:enable Style/RedundantArgument

    # escape kernel::sprintf formatting character
    query_string.gsub!('%', '%%')

    # ready string to accept curator vars
    vars.each_key { |key| query_string.gsub!(format('##%s##', key), "%{#{key}}") }

    # interpolate curator vars
    query_string %= vars

    hash    = {}
    params  = query_string.split('&')
    params.map do |param|
      split = param.split('=', 2)
      (hash[split[0]] ||= []) << split[1]
    end

    hash
  end
end
