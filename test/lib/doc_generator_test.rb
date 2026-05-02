# frozen_string_literal: true

require 'test_helper'
require 'doc_generator'

# Net::HTTPResponse subclasses raise IOError when reading #body outside a real HTTP session
# in recent Ruby; use duck-typed stand-ins for unit tests.
class FakeSolrHttpSuccess
  def initialize body
    @body = body
  end

  attr_reader :body

  def code
    '200'
  end

  def message
    'OK'
  end

  def is_a? klass
    Net::HTTPSuccess == klass ? true : super
  end
end

class FakeSolrHttpFailure
  def initialize code, message, body = ''
    @code = code.to_s
    @message = message
    @body = body
  end

  attr_reader :code, :message, :body

  def is_a? klass
    Net::HTTPSuccess == klass ? false : super
  end
end

class DocGeneratorTest < ActiveSupport::TestCase
  let(:default_options) do
    {
      field:         'text',
      id:            'id',
      logger:        Logger.new(IO::NULL),
      number:        1,
      query:         '*:*',
      rows:          1,
      show_progress: false,
    }
  end
  let(:solr_url)  { 'http://solr.quepidapp.com:8983/solr/statedecoded/select' }
  let(:generator) { DocGenerator.new solr_url, default_options }

  setup do
    body = File.read(Rails.root.join('test/fixtures/files/solr_statedecoded_response.json'))

    ruby_headers = {
      'Accept'          => '*/*',
      'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
      'Host'            => 'solr.quepidapp.com:8983',
      'User-Agent'      => 'Ruby',
    }

    # DocGenerator's default `*:*` query.
    stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=*:*&rows=10&start=0')
      .with(headers: ruby_headers).to_return(status: 200, body: body)

    # `served` is the seed query used by 'generates a list of docs per query'.
    stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=*&q=served&rows=1&start=0')
      .with(headers: ruby_headers)
      .to_return(status: 200, body: <<~JSON)
        {
          "responseHeader":{
            "zkConnected":true,
            "status":0,
            "QTime":1,
            "params":{
              "q":"served",
              "fl":"id",
              "start":"0",
              "rows":"1"}},
          "response":{"numFound":1552,"start":0,"docs":[
              {"id":"l_13688"}]
          }}
      JSON
  end

  describe 'method chaining' do
    test 'handles chaining of methods' do
      assert_respond_to generator.fetch_enough_docs_for_sample_words,
                        :generate_word_list
    end

    test 'raises an error if it attempts to generate a word list before the target set is defined' do
      assert_raises(TargetSetEmpty) { generator.generate_word_list }
    end

    test 'raises an error if it attempts to generate a query list before the word list is defined' do
      assert_raises(WordsEmpty) { generator.generate_query_list }
    end

    test 'raises an error if it attempts to results for a query before the query list is defined' do
      assert_raises(QueriesEmpty) { generator.fetch_results_per_query }
    end
  end

  describe 'generate docs' do
    test 'generates a list of docs per query' do
      generator.queries = [ 'served' ] # Mock list of queries generated
      generator.fetch_results_per_query

      assert_not_nil generator.docs
    end
  end

  describe 'Solr HTTP options' do
    test 'merges string-key options with Solr defaults' do
      g = DocGenerator.new solr_url, {
        'number'        => 2,
        'show_progress' => false,
        'field'         => 'text',
        'id'            => 'id',
        'logger'        => Logger.new(IO::NULL),
        'query'         => '*:*',
        'rows'          => 1,
        'solr_retries'  => 2,
      }

      assert_equal 2, g.options[:solr_retries]
      assert_equal 30, g.options[:solr_retry_max_delay]
      assert_equal 15, g.options[:solr_open_timeout]
      assert_equal 90, g.options[:solr_read_timeout]
    end
  end

  describe 'retryable_solr_http_response?' do
    test 'treats 429 and 5xx as retryable' do
      assert generator.send(:retryable_solr_http_response?, Net::HTTPTooManyRequests.new('1.1', '429', 'Too Many'))
      assert generator.send(:retryable_solr_http_response?, Net::HTTPServiceUnavailable.new('1.1', '503', 'Error'))
      assert generator.send(:retryable_solr_http_response?, Net::HTTPInternalServerError.new('1.1', '500', 'Error'))
    end

    test 'does not treat 4xx other than 429 as retryable' do
      assert_not generator.send(:retryable_solr_http_response?, Net::HTTPBadRequest.new('1.1', '400', 'Bad'))
      assert_not generator.send(:retryable_solr_http_response?, Net::HTTPNotFound.new('1.1', '404', 'No'))
    end

    test 'returns false for nil response' do
      assert_not generator.send(:retryable_solr_http_response?, nil)
    end
  end

  describe 'retry_backoff_seconds' do
    test 'uses exponential backoff capped by max_delay' do
      assert_equal 1, generator.send(:retry_backoff_seconds, 1, 30)
      assert_equal 2, generator.send(:retry_backoff_seconds, 2, 30)
      assert_equal 16, generator.send(:retry_backoff_seconds, 5, 30)
      assert_equal 30, generator.send(:retry_backoff_seconds, 6, 30)
    end
  end

  describe 'parse_solr_json_response' do
    test 'parses JSON body on success' do
      ok = FakeSolrHttpSuccess.new('{"response":{"docs":[{"id":"1"}]}}')

      parsed = generator.send(:parse_solr_json_response, ok)

      assert_equal [ { 'id' => '1' } ], parsed['response']['docs']
    end

    test 'raises when HTTP status is not success' do
      bad = FakeSolrHttpFailure.new('400', 'Bad Request', 'oops')

      error = assert_raises(RuntimeError) { generator.send(:parse_solr_json_response, bad) }

      assert_match(/HTTP 400/, error.message)
    end

    test 'raises a clear error when response is nil' do
      error = assert_raises(RuntimeError) { generator.send(:parse_solr_json_response, nil) }

      assert_match(/empty response/, error.message)
    end

    test 'propagates JSON parse errors from malformed body' do
      ok = FakeSolrHttpSuccess.new('not-json')

      assert_raises(JSON::ParserError) { generator.send(:parse_solr_json_response, ok) }
    end
  end

  describe 'solr_get_response' do
    let(:uri) { URI.parse(solr_url) }

    test 'retries on 503 then returns successful response' do
      gen = DocGenerator.new solr_url, default_options
      calls = 0
      gen.define_singleton_method(:perform_solr_http_get) do |_u|
        calls += 1
        if 1 == calls
          Net::HTTPServiceUnavailable.new('1.1', '503', 'Service Unavailable')
        else
          FakeSolrHttpSuccess.new('{"response":{"docs":[]}}')
        end
      end
      gen.define_singleton_method(:sleep) { |_s| nil }

      result = gen.send(:solr_get_response, uri)

      assert_equal 2, calls
      assert_kind_of FakeSolrHttpSuccess, result
    end

    test 'retries on transient exception then returns successful response' do
      gen = DocGenerator.new solr_url, default_options
      calls = 0
      gen.define_singleton_method(:perform_solr_http_get) do |_u|
        calls += 1
        raise Errno::ECONNREFUSED, 'Connection refused' if 1 == calls

        FakeSolrHttpSuccess.new('{"response":{"docs":[]}}')
      end
      gen.define_singleton_method(:sleep) { |_s| nil }

      result = gen.send(:solr_get_response, uri)

      assert_equal 2, calls
      assert_kind_of FakeSolrHttpSuccess, result
    end

    test 'returns last response when retries exhausted on 503' do
      gen = DocGenerator.new solr_url, default_options.merge(solr_retries: 5)
      calls = 0
      gen.define_singleton_method(:perform_solr_http_get) do |_u|
        calls += 1
        Net::HTTPServiceUnavailable.new('1.1', '503', 'Service Unavailable')
      end
      gen.define_singleton_method(:sleep) { |_s| nil }

      result = gen.send(:solr_get_response, uri)

      assert_equal 6, calls
      assert_equal '503', result.code
    end

    test 're-raises when exception retries are exhausted' do
      gen = DocGenerator.new solr_url, default_options.merge(solr_retries: 2)
      calls = 0
      gen.define_singleton_method(:perform_solr_http_get) do |_u|
        calls += 1
        raise Errno::ECONNREFUSED, 'Connection refused'
      end
      gen.define_singleton_method(:sleep) { |_s| nil }

      assert_raises(Errno::ECONNREFUSED) { gen.send(:solr_get_response, uri) }

      assert_equal 3, calls
    end
  end
end
