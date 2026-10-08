# frozen_string_literal: true

require 'test_helper'

class CsvExportTest < ActiveSupport::TestCase
  test 'neutralizes formulas in all string columns and preserves CSV escaping' do
    values = [ '=1+1', "\t @SUM(1)", "line,\nquote\"", -2, nil ]
    assert_equal [ ' =1+1', ' @SUM(1)', "line,\nquote\"", '-2', nil ], CSV.parse_line(CsvExport.line(values))
    assert_equal ' =1+1', CsvExport.field(CsvExport.field('=1+1'))
  end

  # Shared with test/javascript/utils/csv_cross_language.test.js, which proves the
  # JS importer reads this exporter's output. If this fails because the exporter
  # changed on purpose, regenerate the fixture and re-run the Vitest spec.
  test 'matches the shared cross-language CSV fixture' do
    cases = JSON.parse(Rails.root.join('test/fixtures/files/csv_round_trip_cases.json').read)

    cases.each do |fixture|
      assert_equal fixture['ruby_csv'], CsvExport.line(fixture['values'])
    end
  end
end
