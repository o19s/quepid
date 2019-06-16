# frozen_string_literal: true

require 'test_helper'

class EsArgParserTest < ActiveSupport::TestCase
  test 'parses basic case' do
    params = '{ "foo": 1234 }'
    result = EsArgParser.parse(params)

    assert_equal result['foo'], 1234
  end

  test 'replaces curator vars with values' do
    params  = '{ "foo": "##var1##" }'
    vars    = { 'var1': 1, 'var2': 2 }
    result  = EsArgParser.parse(params, vars)

    assert_equal result['foo'], '1'
  end

  test 'handles params that do not have a curator var' do
    params  = '{ "foo": "bar" }'
    vars    = { 'k': 1 }
    result  = EsArgParser.parse(params, vars)

    assert_equal result['foo'], 'bar'
  end

  test 'handles params with a %' do
    params  = '{ "foo": "##var1##", "bar": "100%" }'
    vars    = { 'var1': 1, 'var2': 2 }
    result  = EsArgParser.parse(params, vars)

    assert_equal result['foo'], '1'
    assert_equal result['bar'], '100%'
  end

  test 'handles params with a % when no curator vars are given' do
    params  = '{ "bar": "100%" }'
    vars    = {}
    result  = EsArgParser.parse(params, vars)

    assert_equal result['bar'], '100%'
  end

  test 'works with a car named `boost`' do
    params  = '{ "foo": "##boost##" }'
    vars    = { 'boost': 42 }
    result  = EsArgParser.parse(params, vars)

    assert_equal result['foo'], '42'
  end
end
