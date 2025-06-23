# frozen_string_literal: true

require 'test_helper'
require 'doc_generator'

class DocGeneratorTest < ActiveSupport::TestCase
  let(:default_options) do
    {
      field:         'text',
      id:            'id',
      logger:        Logger.new($stdout),
      number:        1,
      query:         '*:*',
      rows:          1,
      show_progress: false,
    }
  end
  let(:solr_url)  { 'http://solr.quepidapp.com:8983/solr/statedecoded/select' }
  let(:generator) { DocGenerator.new solr_url, default_options }

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
end
