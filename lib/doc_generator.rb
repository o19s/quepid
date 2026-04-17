# frozen_string_literal: true

require 'json'
require 'net/http'
require 'progress_indicator'

# Exceptions from Net::HTTP and the socket stack that are worth retrying when Solr is
# overloaded or briefly unreachable.
SOLR_RETRYABLE_EXCEPTIONS = [
  Net::OpenTimeout,
  Net::ReadTimeout,
  Errno::ECONNREFUSED,
  Errno::ECONNRESET,
  Errno::ETIMEDOUT,
  Errno::EHOSTUNREACH,
  SocketError,
  IOError
].freeze

class TargetSetEmpty < StandardError
  def initialize msg = 'Attempting to generate word list before assigning target set. Try calling the `fetch_enough_docs_for_sample_words` beforehand, or settting the attribute manually.'
    super
  end
end

class WordsEmpty < StandardError
  def initialize msg = 'Attempting to generate query list before assigning the word list. Try calling the `generate_word_list` beforehand, or settting the attribute manually.'
    super
  end
end

class QueriesEmpty < StandardError
  def initialize msg = 'Attempting to generate results before assigning the query list. Try calling the `fetch_results_per_query` beforehand, or settting the attribute manually.'
    super
  end
end

class DocGenerator
  include ProgressIndicator

  attr_reader :logger, :options, :solr_url

  attr_accessor :target_set, :words, :queries, :docs

  def initialize solr_url, options
    # solr_retries is how many times we *retry* after a failed attempt; if Solr keeps
    # returning 503/429, you may see up to solr_retries + 1 HTTP requests before we stop.
    solr_defaults = {
      solr_retries:         5,
      solr_retry_max_delay: 30,
      solr_open_timeout:    15,
      solr_read_timeout:    90,
    }
    @options  = solr_defaults.merge(options.deep_symbolize_keys)
    @logger   = @options[:logger]
    @solr_url = solr_url
  end

  def show_progress?
    options[:show_progress]
  end

  def fetch_enough_docs_for_sample_words
    print_step 'Fetching docs to extract sample queries'

    times = (@options[:number] / 10).ceil
    times = @options[:number] if times.zero?
    docs  = []

    block_with_progress_bar(times) do
      uri = URI(@solr_url)
      params = {
        q: @options[:query],
        start: 0, rows: 10,
        fl: [ @options[:id], @options[:field] ].join(',')
      }
      uri.query = URI.encode_www_form(params)

      res = solr_get_response(uri)
      response = parse_solr_json_response(res)

      docs += response['response']['docs']
    end

    @target_set = docs

    self
  end

  def generate_word_list
    print_step 'Generating word list'

    raise TargetSetEmpty if @target_set.blank?

    stop_words = %w[a an and are as at be but by for if in into is it
                    no not of on or such that the their then there
                    these they this to was will with]

    all_words = @target_set.map { |doc| doc[@options[:field]] }
    all_words = all_words.join(' ')
    all_words = all_words.downcase.gsub(/[^[:word:]\s]/, ' ')

    @words = all_words.split.uniq - stop_words

    self
  end

  # Make sure we have enough queries.
  # Sometimes the unique list of words extracted from the sample field
  # is not enough, so we can create extra queries by combining words.
  def generate_query_list
    print_step 'Generating query list'

    raise WordsEmpty if @words.blank?

    level   = 1
    queries = []

    while queries.count < (@options[:number] * 10)
      queries += @words.combination(level).to_a.map { |each| each.join(' ') }
      queries = queries.uniq
      level += 1
    end

    @queries = queries

    self
  end

  def fetch_results_per_query
    print_step 'Fetching results for queries'

    raise QueriesEmpty if @queries.blank?

    queries = @queries # set to a temp variable because we are deleting
    # values as we go

    results = []

    block_with_progress_bar(@options[:number]) do
      query = queries.sample
      queries.delete(query)
      results += fetch_results_for_single_query query
    end

    @docs = results

    self
  end

  private

  def fetch_results_for_single_query query
    uri = URI(@solr_url)
    params = {
      q: query,
      start: 0, rows: @options[:rows],
      fl: @options[:id]
    }
    uri.query = URI.encode_www_form(params)

    res = solr_get_response(uri)
    response = parse_solr_json_response(res)

    docs = response['response']['docs']

    docs.map { |doc| { query_text: query, doc_id: doc[@options[:id]] } }
  end

  # Performs a Solr GET with exponential backoff on transient failures and configurable
  # connect/read timeouts (defaults are higher than Net::HTTP's to avoid spurious timeouts
  # when the remote Solr is slow or under load).
  #
  # See +solr_defaults+ in #initialize for how +solr_retries+ relates to total HTTP attempts.
  def solr_get_response uri
    retries = @options.fetch(:solr_retries, 5)
    max_delay = @options.fetch(:solr_retry_max_delay, 30)
    attempt = 0

    loop do
      attempt += 1
      begin
        response = perform_solr_http_get(uri)
        if retryable_solr_http_response?(response) && attempt <= retries
          delay = retry_backoff_seconds(attempt, max_delay)
          solr_retry_log("HTTP #{response.code} from Solr", attempt, retries, delay)
          sleep(delay)
          next
        end
        return response
      rescue *SOLR_RETRYABLE_EXCEPTIONS => e
        raise if attempt > retries

        delay = retry_backoff_seconds(attempt, max_delay)
        solr_retry_log("#{e.class}: #{e.message}", attempt, retries, delay)
        sleep(delay)
      end
    end
  end

  def perform_solr_http_get uri
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = ('https' == uri.scheme)
    http.open_timeout = @options.fetch(:solr_open_timeout, 15)
    http.read_timeout = @options.fetch(:solr_read_timeout, 90)
    http.start do |conn|
      conn.request(Net::HTTP::Get.new(uri))
    end
  end

  def parse_solr_json_response response
    raise 'Solr request failed: empty response' if response.nil?

    unless response.is_a?(Net::HTTPSuccess)
      code = response.respond_to?(:code) ? response.code : '?'
      message = response.respond_to?(:message) ? response.message : ''
      raise "Solr request failed: HTTP #{code} #{message}"
    end

    JSON.parse(response.body)
  end

  def retryable_solr_http_response? response
    return false unless response

    code = response.code.to_i
    (code >= 500 && code < 600) || 429 == code
  end

  def retry_backoff_seconds attempt, max_delay
    [ 2**(attempt - 1), max_delay ].min
  end

  def solr_retry_log message, attempt, retries, delay
    return unless show_progress?

    print_step "Solr request failed (#{message}), retrying in #{delay}s (#{attempt}/#{retries})"
  end
end
