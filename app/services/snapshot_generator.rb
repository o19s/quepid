# frozen_string_literal: true

require 'progress_indicator'
require 'doc_generator'

class SnapshotGenerator
  include ProgressIndicator

  attr_accessor :logger, :options, :solr

  def initialize solr_url, opts = {}
    default_options = {
      field:         'text',
      id:            'id',
      logger:        Logger.new($stdout),
      number:        10,
      query:         '*:*',
      rows:          10,
      show_progress: false,
    }

    @options    = default_options.merge(opts.deep_symbolize_keys)
    @logger     = @options[:logger]
    @generator  = DocGenerator.new solr_url, @options
  end

  def show_progress?
    options[:show_progress]
  end

  def generate_snapshot
    @generator.fetch_enough_docs_for_sample_words
      .generate_word_list
      .generate_query_list
      .fetch_results_per_query

    positioned_docs = position_docs @generator.docs

    positioned_docs
  end

  def position_docs docs
    print_step 'Assigning positions to docs'

    block_with_progress_bar(docs.length) do |i|
      tmp = docs.select { |doc| doc[:query_text] == docs[i][:query_text] }
      position = tmp.index(docs[i])
      docs[i][:position] = position + 1
    end

    docs
  end
end
