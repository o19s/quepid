# frozen_string_literal: true

require 'test_helper'
require 'solr_arg_parser'

class SolrArgParserTest < ActiveSupport::TestCase
  test 'it creates a new solr Args' do
    sa = SolrArgParser.parse('a string')
    assert_kind_of Hash, sa
  end

  test 'split lines and clean whitespace' do
    sa = SolrArgParser.parse("
                       q=foo&
                        t=bar")
    assert_equal [ 'foo' ], sa['q']
    assert_equal [ 'bar' ], sa['t']
  end

  test 'simple params parsing' do
    sa = SolrArgParser.parse('q=foo&t=bar')
    assert_equal [ 'foo' ], sa['q']
    assert_equal [ 'bar' ], sa['t']
  end

  test 'handles % characters in the string' do
    sa = SolrArgParser.parse('q=%d&t=ba%r')
    assert_equal [ '%d' ], sa['q']
    assert_equal [ 'ba%r' ], sa['t']
  end

  test 'subs in curator vars' do
    sa = SolrArgParser.parse('q=##avar##&t=z##bvar##o', avar: 'a', bvar: 'o')
    assert_equal [ 'a' ], sa['q']
    assert_equal [ 'zoo' ], sa['t']
  end
end
