# frozen_string_literal: true

require 'test_helper'

class SolrArgParserTest < ActiveSupport::TestCase
  test 'parses nil value' do
    params = nil
    result = SolrArgParser.parse(params)
    assert_empty result
  end

  test 'parses basic case' do
    params = 'foo=1234'
    result = SolrArgParser.parse(params)

    assert_equal [ '1234' ], result['foo']
  end

  test 'parses multi valued params' do
    params = 'foo=1234&foo=789'
    result = SolrArgParser.parse(params)

    assert_includes result['foo'], '1234'
    assert_includes result['foo'], '789'
  end

  test 'parses local params' do
    params = 'q={localparam=paramval1}val&foo=1234'
    result = SolrArgParser.parse(params)

    assert_equal [ '{localparam=paramval1}val' ], result['q']
    assert_equal [ '1234' ], result['foo']
  end

  test 'replaces curator vars with values' do
    params  = "#\$query##&foo=##var1##&foo=##var2##"
    vars    = { var1: 1, var2: 2 }
    result  = SolrArgParser.parse(params, vars)

    assert_includes result['foo'], vars[:var1].to_s
    assert_includes result['foo'], vars[:var2].to_s

    params  = "#\$query##&foo=##var1##&bar=##var2##"
    vars    = { var1: 1, var2: 2 }
    result  = SolrArgParser.parse(params, vars)

    assert_includes result['foo'], vars[:var1].to_s
    assert_includes result['bar'], vars[:var2].to_s
  end

  test 'removes EOL chars' do
    params = "foo=1234\n&bar=789\n"
    result = SolrArgParser.parse(params)

    assert_includes result['foo'], '1234'
    assert_includes result['bar'], '789'
  end

  test 'strips white space' do
    params = " foo=1234  \n&bar=789  \n"
    result = SolrArgParser.parse(params)

    assert_includes result['foo'], '1234'
    assert_includes result['bar'], '789'
  end

  test 'handles params with semi colons' do
    params = 'foo=taco::1:3;5:1.5;6:0;7:2;;burrito.bowl::1:3;5:1.5;6:0;7:2'
    result = SolrArgParser.parse(params)

    assert_includes result['foo'], 'taco::1:3;5:1.5;6:0;7:2;;burrito.bowl::1:3;5:1.5;6:0;7:2'
  end
end
