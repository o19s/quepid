# frozen_string_literal: true

require 'net/http'
require 'progress_indicator'

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
    @options  = options
    @logger   = @options[:logger]
    @solr_url = solr_url
  end

  def show_progress?
    options[:show_progress]
  end

  def fetch_enough_docs_for_sample_words
    print_step 'Fetching docs to extract sample queries'

    start = 0
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

      res = Net::HTTP.get_response(uri)
      response = JSON.parse(res.body)

      docs += response['response']['docs']
      start += 1
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

    res = Net::HTTP.get_response(uri)

    response = JSON.parse(res.body)

    docs = response['response']['docs']

    docs.map { |doc| { query_text: query, doc_id: doc[@options[:id]] } }
  end
end
