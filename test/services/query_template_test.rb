# frozen_string_literal: true

require 'test_helper'

class QueryTemplateTest < ActiveSupport::TestCase
  # The same cases test/javascript/query_template_parity.test.js runs through
  # splainer-search, so the Ruby port can't drift from the browser.
  FIXTURE = JSON.parse(Rails.root.join('test/fixtures/files/query_template_cases.json').read)

  FIXTURE['cases'].each do |test_case|
    test "matches the browser: #{test_case['name']}" do
      parameters = QueryTemplate.parameters(test_case['query_text'], test_case['q_option'])

      assert_equal test_case['expected'], QueryTemplate.hydrate(test_case['template'], parameters)
    end
  end

  test 'does not modify the template it is given' do
    template = { 'q' => '#$query##' }

    QueryTemplate.hydrate(template, QueryTemplate.parameters('star wars'))

    assert_equal({ 'q' => '#$query##' }, template)
  end

  test 'prints numbers the way JavaScript does' do
    assert_equal '1', QueryTemplate.js_string(1.0)
    assert_equal '0.000012', QueryTemplate.js_string(0.000012)
    assert_equal '1.5e-7', QueryTemplate.js_string(1.5e-7)
    assert_equal '-0.1234567', QueryTemplate.js_string(-0.1234567)
    assert_equal '1,,2', QueryTemplate.js_string([ 1, nil, 2 ])
  end
end
