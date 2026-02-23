# frozen_string_literal: true

require 'test_helper'

class V8MapperExecutorTest < ActiveSupport::TestCase
  let(:v8_executor) do
    V8MapperExecutor.new(Rails.root.join('lib/mapper_code_logic.js'))
  end

  describe 'raising error if required functions are missing' do
    test 'numberOfResultsMapper function is missing' do
      code_mapper = <<~TEXT
        docsMapper = function(data){#{' ' * 16}
        };
      TEXT

      assert_raises(StandardError) do
        v8_executor.extract_docs code_mapper, ''
      end
    end

    test 'docsMapper function is missing' do
      code_mapper = <<~TEXT
        numberOfResultsMapper = function(data){#{' ' * 16}
        };
      TEXT

      assert_raises(StandardError) do
        v8_executor.extract_docs code_mapper, ''
      end
    end
  end

  describe 'parsing JSON' do
    describe 'conversion' do
      test 'runs simple' do
        # scorer_code = File.read('db/scorers/p@10.js')
        # docs = [
        #   { id: 1, rating: 1 },
        #   { id: 2, rating: 0 }
        # ]
        # best_docs = []
        # score = javascript_scorer.score(docs, best_docs, scorer_code)
        # assert_equal 0.5, score
        assert true
      end
    end
    describe 'when score data is invalid' do
      let(:the_case) { cases(:case_without_score) }

      test 'runs even though no scores provided' do
        assert true
      end
    end
  end

  describe 'console log capture' do
    test 'captures console.log messages' do
      code_mapper = <<~JS
        numberOfResultsMapper = function(data) {
          console.log('Testing log capture');
          return 0;
        }
        docsMapper = function(data) { return []; }
      JS

      v8_executor.extract_number_of_results(code_mapper, '')

      assert_equal 1, v8_executor.logs.length
      assert_equal 'log', v8_executor.logs.first[:level]
      assert_equal 'Testing log capture', v8_executor.logs.first[:message]
      assert_predicate v8_executor.logs.first[:timestamp], :present?
    end

    test 'captures multiple log messages in order' do
      code_mapper = <<~JS
        numberOfResultsMapper = function(data) {
          console.log('First message');
          console.warn('Second message');
          console.error('Third message');
          return 0;
        }
        docsMapper = function(data) { return []; }
      JS

      v8_executor.extract_number_of_results(code_mapper, '')

      assert_equal 3, v8_executor.logs.length
      assert_equal 'First message', v8_executor.logs[0][:message]
      assert_equal 'log', v8_executor.logs[0][:level]
      assert_equal 'Second message', v8_executor.logs[1][:message]
      assert_equal 'warn', v8_executor.logs[1][:level]
      assert_equal 'Third message', v8_executor.logs[2][:message]
      assert_equal 'error', v8_executor.logs[2][:level]
    end

    test 'clear_logs empties the logs array' do
      code_mapper = <<~JS
        numberOfResultsMapper = function(data) {
          console.log('Message to clear');
          return 0;
        }
        docsMapper = function(data) { return []; }
      JS

      v8_executor.extract_number_of_results(code_mapper, '')
      assert_equal 1, v8_executor.logs.length

      v8_executor.clear_logs
      assert_equal 0, v8_executor.logs.length
    end

    test 'logs objects as JSON' do
      code_mapper = <<~JS
        numberOfResultsMapper = function(data) {
          console.log('Object:', { key: 'value', count: 42 });
          return 0;
        }
        docsMapper = function(data) { return []; }
      JS

      v8_executor.extract_number_of_results(code_mapper, '')

      assert_equal 1, v8_executor.logs.length
      assert_includes v8_executor.logs.first[:message], '"key":"value"'
      assert_includes v8_executor.logs.first[:message], '"count":42'
    end
  end

  describe 'parsing HTML response body' do
    let(:scorer_code) do
      File.read('db/scorers/ap@10.js')
    end
    test 'runs simple' do
      # # order matters!
      # docs = [
      #   { id: 1, rating: 0 },
      #   { id: 2, rating: 1 }
      # ]

      # # Can be in any order
      # best_docs = [
      #   { id: 2, rating: 1 },
      #   { id: 1, rating: 0 },
      #   { id: 3, rating: 1 }
      # ]

      # Two ways to get the mapper code:
      # 1. Load directly from file (original approach):
      mapper_code = File.read(Rails.root.join('test/fixtures/files/lse_searchapi_mapper_code.js'))

      # 2. Load from fixture (new approach - no manual loading needed):
      # mapper_code = search_endpoints(:searchapi).mapper_code
      response_body = File.readlines(Rails.root.join('test/fixtures/files/lse_searchapi_response.html'))
      # score = javascript_scorer.score(docs, best_docs, scorer_code)
      docs = v8_executor.extract_docs mapper_code, response_body
      assert_equal 10, docs.length

      doc = docs.second.symbolize_keys
      assert_equal 'Millicent Makina', doc[:title]
      assert_equal 'https://lse.ac.uk/school-of-public-policy/student-community/student-profiles/millicent-makina.aspx',
                   doc[:url]
    end
  end

  describe 'parsing JSON string and HTML response bodies' do
    test 'parses JSON string response body correctly' do
      code_mapper = <<~JS
        numberOfResultsMapper = function(data) {
          return data.root.fields.totalCount;
        }
        docsMapper = function(data) {
          let docs = [];
          if (data.root && data.root.children) {
            for (let child of data.root.children) {
              docs.push({
                id: child.id,
                title: child.fields.title,
                relevance: child.relevance
              });
            }
          }
          return docs;
        }
      JS

      # Simulate a JSON response from Vespa or similar API
      json_response = {
        root: {
          id: 'toplevel',
          relevance: 1,
          fields: { totalCount: 2 },
          children: [
            {
              id: 'doc1',
              relevance: 0.95,
              fields: { title: 'First Document', content: 'Content here' }
            },
            {
              id: 'doc2',
              relevance: 0.85,
              fields: { title: 'Second Document', content: 'More content' }
            }
          ]
        }
      }.to_json

      # Extract documents
      docs = v8_executor.extract_docs(code_mapper, json_response)
      assert_equal 2, docs.length
      assert_equal 'doc1', docs[0]['id']
      assert_equal 'First Document', docs[0]['title']
      assert_equal 0.95, docs[0]['relevance']

      # Extract number of results
      num_results = v8_executor.extract_number_of_results(code_mapper, json_response)
      assert_equal 2, num_results
    end

    test 'handles plain HTML text response body' do
      code_mapper = <<~JS
        numberOfResultsMapper = function(data) {
          // For HTML, just return a fixed count for testing
          return 2;
        }
        docsMapper = function(data) {
          var docs = [];
          // Simple check - if it contains HTML, return mock docs
          if (data.indexOf('<html>') > -1) {
            docs.push({ id: 'res1', title: 'HTML Result One' });
            docs.push({ id: 'res2', title: 'HTML Result Two' });
          }
          return docs;
        }
      JS

      html_response = <<~HTML
        <html>
          <body>
            <div class="result" id="res1">
              <h2>HTML Result One</h2>
              <p>Description</p>
            </div>
            <div class="result" id="res2">
              <h2>HTML Result Two</h2>
              <p>Another description</p>
            </div>
          </body>
        </html>
      HTML

      # Extract documents from HTML
      docs = v8_executor.extract_docs(code_mapper, html_response)
      assert_equal 2, docs.length
      assert_equal 'res1', docs[0]['id']
      assert_equal 'HTML Result One', docs[0]['title']

      # Extract number of results from HTML
      num_results = v8_executor.extract_number_of_results(code_mapper, html_response)
      assert_equal 2, num_results
    end
  end
end
