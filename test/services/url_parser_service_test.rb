# frozen_string_literal: true

require 'test_helper'

class UrlParserServiceTest < ActiveSupport::TestCase
  test 'parse returns Addressable::URI for valid URL' do
    uri = UrlParserService.parse('https://example.com/path?q=1')
    assert_instance_of Addressable::URI, uri
    assert_equal 'https', uri.scheme
    assert_equal 'example.com', uri.host
    assert_equal '/path', uri.path
  end

  test 'parse returns nil for blank or nil' do
    assert_nil UrlParserService.parse('')
    assert_nil UrlParserService.parse(nil)
    assert_nil UrlParserService.parse('   ')
  end

  test 'scheme extracts protocol' do
    assert_equal 'https', UrlParserService.scheme('https://example.com')
    assert_equal 'http', UrlParserService.scheme('http://example.com:8080/path')
    assert_nil UrlParserService.scheme('invalid')
  end

  test 'query_values extracts params from URL' do
    assert_equal({ 'q' => 'test', 'rows' => '10' },
                 UrlParserService.query_values('http://example.com/search?q=test&rows=10'))
  end

  test 'query_values returns empty hash when no query string' do
    assert_empty UrlParserService.query_values('http://example.com/search')
  end

  test 'query_values returns empty hash for invalid URL' do
    assert_empty UrlParserService.query_values('not a url')
  end

  test 'query_values handles multi-param and non-ASCII' do
    result = UrlParserService.query_values('http://example.com/search?q=café&rows=10')
    assert_equal 'café', result['q']
    assert_equal '10', result['rows']
  end

  test 'http_or_https? returns true for http and https' do
    assert UrlParserService.http_or_https?('https://example.com')
    assert UrlParserService.http_or_https?('http://example.com')
    assert UrlParserService.http_or_https?('HTTPS://example.com')
    assert UrlParserService.http_or_https?('HTTP://example.com')
  end

  test 'http_or_https? returns false for invalid or other schemes' do
    assert_not UrlParserService.http_or_https?('ftp://example.com')
    assert_not UrlParserService.http_or_https?('invalid')
    assert_not UrlParserService.http_or_https?('')
  end
end
