# frozen_string_literal: true

require 'bigdecimal'

# Fills #$...## placeholders in a try's query template the way the browser does, so a
# background evaluation (FetchService: nightly runs, RunCaseEvaluationJob) sends the same
# request the case page sends. A port of splainer-search's queryTemplateSvc#hydrate
# (node_modules/splainer-search/services/queryTemplateSvc.js); keep the two in step.
#
# Placeholders:
#   #$query##              the query text
#   #$keyword1##, ...      its words (empty string when there are fewer)
#   #$qOption.a.b##        a (nested) value from the query's options over the try's
#                          options -- e.g. #$qOption.query_vec## for the query's vector
#   #$qOption.a|default##  `default` when the last key is missing
#
# A string that is *only* a placeholder is replaced by the raw value, so
# {"query_vector": "#$qOption.query_vec##"} becomes a JSON array. A placeholder inside a
# longer string is replaced by the value as JavaScript would print it -- an array becomes
# "1,2,3" -- so a Solr "{!knn f=vec}[#$qOption.query_vec##]" gets its numbers. A
# placeholder with nothing to fill it is left as is.
module QueryTemplate
  PLACEHOLDER = /#\$([\w.|]+)##/
  WHOLE_PLACEHOLDER = /\A#\$[\w.|]+##\z/

  module_function

  # @param query_text [String]
  # @param q_option [Hash] the try's options merged with the query's options
  def parameters query_text, q_option = {}
    keywords = query_text.to_s.split(/[ ,]+/).map(&:strip)
    params = { 'query' => query_text.to_s, 'keyword' => keywords, 'qOption' => q_option || {} }
    keywords.each_with_index { |keyword, index| params["keyword#{index + 1}"] = keyword }
    params
  end

  # @return a copy of template (Hash/Array/String, nested) with placeholders filled
  def hydrate template, parameters
    case template
    when String then fill_string(template, parameters)
    when Array then template.map { |entry| hydrate(entry, parameters) }
    when Hash then template.transform_values { |value| hydrate(value, parameters) }
    else template
    end
  end

  # The value as JavaScript's String(value) prints it, for embedding in a string.
  def js_string value
    case value
    when String then value
    when nil then 'null'
    when Array then value.map { |entry| entry.nil? ? '' : js_string(entry) }.join(',')
    when Hash then '[object Object]'
    when Float then js_number(value)
    else value.to_s
    end
  end

  def fill_string string, parameters
    replacements = string.scan(PLACEHOLDER).filter_map do |(path)|
      value = lookup(parameters, path)
      [ "\#$#{path}##", value ] unless value.nil?
    end

    if string.match?(WHOLE_PLACEHOLDER)
      replacements.empty? ? string : replacements.first.last
    else
      replacements.reduce(string) { |filled, (placeholder, value)| filled.gsub(placeholder) { js_string(value) } }
    end
  end

  # getDescendantProp: walk "a.b.c", with "c|d" meaning d when c is missing.
  def lookup parameters, path
    keys = path.split('.').map(&:strip).reject(&:empty?)
    value = parameters
    until keys.empty? || value.nil?
      key = keys.shift
      default = nil
      if key.include?('|')
        key, default = key.split('|')
      elsif key.match?(/keyword\d+/)
        default = ''
      end
      value = child(value, key, default)
    end
    value
  end

  def child container, key, default
    case container
    when Hash then container.key?(key) ? container[key] : default
    when Array then key.match?(/\A\d+\z/) && key.to_i < container.size ? container[key.to_i] : default
    else default
    end
  end

  # Like JavaScript: 1.0 prints as "1", and plain decimals rather than exponents in the
  # range JavaScript uses them (Ruby would print 0.00001 as "1.0e-05").
  def js_number value
    return value.to_s unless value.finite?
    return value.to_i.to_s if value == value.truncate && value.abs < 1e21

    printed = value.to_s
    return printed unless printed.include?('e')
    return BigDecimal(printed).to_s('F').sub(/\.0\z/, '') if value.abs >= 1e-6 && value.abs < 1e21

    mantissa, exponent = printed.split('e')
    "#{mantissa.sub(/\.0\z/, '')}e#{exponent.to_i.positive? ? '+' : '-'}#{exponent.to_i.abs}"
  end
end
