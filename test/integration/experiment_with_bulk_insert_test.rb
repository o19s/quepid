# frozen_string_literal: true

require 'test_helper'
require 'benchmark'
class ExperimentWithBulkInsertTest < ActionDispatch::IntegrationTest
  # rubocop:disable Rails/SkipsModelValidations
  let(:user) { users(:doug) }
  let(:scorer) { scorers(:quepid_default_scorer) }
  let(:selection_strategy) { selection_strategies(:multiple_raters) }

  # rubocop:disable Style/ClassVars
  @@skip_tests = true
  # rubocop:enable Style/ClassVars

  test 'generate and import query/doc pairs with traditional AR' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    book = user.books.create name: '50000 Query Doc Pairs', scorer: scorer, selection_strategy: selection_strategy
    assert book.valid?
    result = Benchmark.measure do
      50_000.times do
        query_text = generate_random_string
        doc_id = generate_random_string
        document_fields = generate_lorem_ipsum_json
        information_need = generate_lorem_ipsum_json

        qdp = book.query_doc_pairs.create query_text: query_text, doc_id: doc_id, document_fields: document_fields,
                                          information_need: information_need
        puts "Failed to create qdp: #{qdp.errors.full_messages.join(', ')}" unless qdp.valid?
        assert qdp.valid?
      end
      puts "Traditional. Sample data generated successfully.  #{book.query_doc_pairs.count} query doc pairs"
    end

    # Print the elapsed time
    puts "Elapsed time: #{result.real} seconds\n"
  end

  test 'generate and import query/doc pairs with bulk import' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    book = user.books.create name: '50000 Query Doc Pairs', scorer: scorer, selection_strategy: selection_strategy
    assert book.valid?
    result = Benchmark.measure do
      query_doc_pairs = []
      50_000.times do
        query_text = generate_random_string
        doc_id = generate_random_string
        document_fields = generate_lorem_ipsum_json
        information_need = generate_lorem_ipsum_json

        qdp = QueryDocPair.new book: book, query_text: query_text, doc_id: doc_id, document_fields: document_fields,
                               information_need: information_need
        query_doc_pairs << qdp
      end
      QueryDocPair.import query_doc_pairs
      puts "Import. Sample data generated successfully.  #{book.query_doc_pairs.count} query doc pairs"
    end

    # Print the elapsed time
    puts "Elapsed time: #{result.real} seconds\n"
  end

  test 'generate and import query/doc pairs with insert_all' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    book = user.books.create name: '50000 Query Doc Pairs', scorer: scorer, selection_strategy: selection_strategy
    assert book.valid?
    result = Benchmark.measure do
      query_doc_pairs = []
      50_000.times do
        query_text = generate_random_string
        doc_id = generate_random_string
        document_fields = generate_lorem_ipsum_json
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
      puts "Insert All. Sample data generated successfully.  #{book.query_doc_pairs.count} query doc pairs"
    end

    # Print the elapsed time
    puts "Elapsed time: #{result.real} seconds\n"
  end

  test 'generate and export query/doc pairs with upsert_all' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    book = user.books.create name: '50000 Query Doc Pairs', scorer: scorer, selection_strategy: selection_strategy
    assert book.valid?
    result = Benchmark.measure do
      query_doc_pairs = []
      50_000.times do
        query_text = generate_random_string
        doc_id = generate_random_string
        document_fields = generate_lorem_ipsum_json
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
      QueryDocPair.upsert_all(query_doc_pairs)
      puts "Upsert All. Sample data generated successfully.  #{book.query_doc_pairs.count} query doc pairs"
    end

    # Print the elapsed time
    puts "Elapsed time: #{result.real} seconds\n"
  end

  test 'generate and export query/doc pairs with upsert_all when exists already data' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    book = user.books.create name: '50000 Query Doc Pairs', scorer: scorer, selection_strategy: selection_strategy
    assert book.valid?

    query_doc_pairs = []
    50_000.times do
      query_text = generate_random_string
      doc_id = generate_random_string
      document_fields = generate_lorem_ipsum_json
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
    QueryDocPair.upsert_all(query_doc_pairs)

    result = Benchmark.measure do
      QueryDocPair.upsert_all(query_doc_pairs)
    end
    book.reload
    puts "Upsert All When Data Already Loaded. Sample data generated successfully.  #{book.query_doc_pairs.count} query doc pairs"

    assert_equal 50_000, book.query_doc_pairs.count

    # Print the elapsed time
    puts "Elapsed time: #{result.real} seconds\n"
  end
  # rubocop:enable Layout/LineLength

  def generate_random_string length: 10
    charset = Array('A'..'Z') + Array('a'..'z')
    Array.new(length) { charset.sample }.join
  end

  def generate_lorem_ipsum_json
    lorem_ipsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    JSON.generate({ text: lorem_ipsum })
  end
  # rubocop:enable Rails/SkipsModelValidations
end
