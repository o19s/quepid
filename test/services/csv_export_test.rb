# frozen_string_literal: true

require 'test_helper'

class CsvExportTest < ActiveSupport::TestCase
  test 'neutralizes formulas in all string columns and preserves CSV escaping' do
    values = [ '=1+1', "\t @SUM(1)", "line,\nquote\"", -2, nil ]
    assert_equal [ ' =1+1', ' @SUM(1)', "line,\nquote\"", '-2', nil ], CSV.parse_line(CsvExport.line(values))
    assert_equal ' =1+1', CsvExport.field(CsvExport.field('=1+1'))
  end
end
