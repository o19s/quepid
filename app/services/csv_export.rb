# frozen_string_literal: true

require 'csv'

module CsvExport
  # A plain number can't carry a formula, and escaping it would break external tools that
  # join on numeric ids such as doc ids.
  NUMERIC = /\A[-+]?\d+(\.\d+)?\z/

  def self.field value
    return value unless value.is_a?(String)

    stripped = value.lstrip
    return value unless stripped.match?(/\A[=+\-@]/) && !stripped.rstrip.match?(NUMERIC)

    " #{stripped}"
  end

  def self.line values
    CSV.generate_line(values.map { |value| field(value) })
  end
end
