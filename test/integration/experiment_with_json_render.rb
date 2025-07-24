# frozen_string_literal: true

require 'test_helper'
require 'benchmark'
require 'action_view'

class ExperimentWithJsonRender < ActionController::TestCase
  include ActionView::Helpers::NumberHelper

  let(:user) { users(:doug) }
  let(:scorer) { scorers(:quepid_default_scorer) }
  let(:selection_strategy) { selection_strategies(:multiple_raters) }

  # Use this test to understand how long it takes to generate a JSON response.
  # Used it to decide if rapidjson gem was helpful, and decided it wasn't.
  # It takes a VERY long time, so moved this logic to BookExporter job for production use.
  test 'generate 50000 query doc pairs as json' do
    skip('Ignoring all tests in ExperimentWithJsonRender')
    book = user.books.create name: '50000 Query Doc Pairs', scorer: scorer, selection_strategy: selection_strategy
    assert book.valid?

    save_big_book book

    # controller = DummyController.new
    Api::V1::Export::BooksController.new

    result = Benchmark.measure do
      @book = book
      json_data = Api::V1::Export::BooksController.renderer.render template: 'api/v1/export/books/show',
                                                                   assigns:  { book: book }
      puts "Traditional. Sample data generated successfully. #{number_to_human_size(json_data.bytesize)}"
    end

    # Print the elapsed time
    puts "Elapsed time: #{result.real} seconds"
  end

  # rubocop:disable Metrics/MethodLength
  def save_big_book book
    query_doc_pairs = []
    50_000.times do
      # 100.times do
      query_text = generate_random_string
      doc_id = generate_random_string
      document_fields = generate_random_string(length: 300)
      information_need = generate_lorem_ipsum_json

      query_doc_pairs << {
        book_id:          book.id,
        query_text:       query_text,
        doc_id:           doc_id,
        document_fields:  document_fields,
        information_need: information_need,
        created_at:       Time.current,
        updated_at:       Time.current,
      }
    end
    QueryDocPair.insert_all!(query_doc_pairs)
    # rubocop:enable Rails/SkipsModelValidations
  end
  # rubocop:enable Metrics/MethodLength

  def generate_random_string length: 10
    charset = Array('A'..'Z') + Array('a'..'z')
    Array.new(length) { charset.sample }.join
  end

  def generate_lorem_ipsum_json
    lorem_ipsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    JSON.generate({ text: lorem_ipsum })
  end
end
