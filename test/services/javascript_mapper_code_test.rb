# frozen_string_literal: true

require 'test_helper'

class JavascriptMapperCodeTest < ActiveSupport::TestCase
  let(:javascript_mapper_code) do
    JavascriptMapperCode.new(Rails.root.join('lib/mapper_code_logic.js'))
  end

  describe 'raising error if required functions are missing' do
    test 'numberOfResultsMapper function is missing' do
      code_mapper = <<~TEXT
        docsMapper = function(data){#{'                '}
        };
      TEXT

      assert_raises(StandardError) do
        javascript_mapper_code.extract_docs code_mapper, ''
      end
    end

    test 'docsMapper function is missing' do
      code_mapper = <<~TEXT
        numberOfResultsMapper = function(data){#{'                '}
        };
      TEXT

      assert_raises(StandardError) do
        javascript_mapper_code.extract_docs code_mapper, ''
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

      mapper_code = File.read(Rails.root.join('test/fixtures/files/searchapi_mapper_code.js'))
      response_body = File.readlines(Rails.root.join('test/fixtures/files/searchapi_response.html'))
      # score = javascript_scorer.score(docs, best_docs, scorer_code)
      docs = javascript_mapper_code.extract_docs mapper_code, response_body
      assert_equal 10, docs.length

      doc = docs.second.symbolize_keys
      assert_equal 'Millicent Makina', doc[:title]
      assert_equal 'https://lse.ac.uk/school-of-public-policy/student-community/student-profiles/millicent-makina.aspx',
                   doc[:url]
    end
  end
end
