# frozen_string_literal: true

require 'progress_indicator'
require 'doc_generator'

class RatingsGenerator
  include ProgressIndicator

  attr_accessor :logger, :options, :solr_url

  def initialize solr_url, opts = {}
    default_options = {
      field:         'text',
      id:            'id',
      logger:        Logger.new($stdout),
      number:        10,
      query:         '*:*',
      rows:          10,
      scale:         (1..10).to_a,
      show_progress: false,
    }

    @options    = default_options.merge(opts.deep_symbolize_keys)
    @logger     = @options[:logger]
    @generator  = DocGenerator.new solr_url, @options
  end

  def show_progress?
    options[:show_progress]
  end

  def generate_ratings
    @generator.fetch_enough_docs_for_sample_words
      .generate_word_list
      .generate_query_list
      .fetch_results_per_query

    ratings = rate_docs @generator.docs

    ratings
  end

  private

  def rate_docs docs
    print_step 'Assigning ratings to docs'

    block_with_progress_bar(docs.length) do |i|
      docs[i][:rating] = @options[:scale].sample
    end

    docs
  end
end
