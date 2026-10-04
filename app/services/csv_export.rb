# frozen_string_literal: true

require 'csv'

module CsvExport
  def self.field value
    return value unless value.is_a?(String) && value.lstrip.match?(/\A[=+\-@]/)

    " #{value.lstrip}"
  end

  def self.line values
    CSV.generate_line(values.map { |value| field(value) })
  end
end
