# frozen_string_literal: true

require 'test_helper'

module AiJudges
  class WizardControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }
    let(:book) { books(:james_bond_movies) }

    setup do
      login_user_for_integration_test user
    end

    describe 'get sample_query_doc_pair' do
      test 'returns a query_doc_pair from a book the current user can access' do
        get ai_judge_sample_query_doc_pair_url(ai_judge_id: 'new')

        assert_response :success
        body = response.parsed_body
        assert body['query_doc_pair']
        assert_includes(Book.for_user(user).flat_map(&:query_doc_pairs).map(&:id), body['query_doc_pair']['id'])
      end

      test 'scopes to the given book when book_id is provided' do
        get ai_judge_sample_query_doc_pair_url(ai_judge_id: 'new', book_id: book.id)

        assert_response :success
        body = response.parsed_body
        assert_includes(book.query_doc_pairs.map(&:id), body['query_doc_pair']['id'])
      end

      test 'falls back to any accessible book when book_id is not accessible to the current user' do
        other_owner = users(:case_finder_user)
        private_book = Book.create!(name: 'owner-private book', owner: other_owner)
        private_book.query_doc_pairs.create!(query_text: 'q', doc_id: 'd', position: 1)

        get ai_judge_sample_query_doc_pair_url(ai_judge_id: 'new', book_id: private_book.id)

        assert_response :success
        body = response.parsed_body
        assert_not_equal private_book.query_doc_pairs.first.id, body.dig('query_doc_pair', 'id')
      end
    end

    describe 'post test_prompt' do
      setup { register_default_openai_stubs }

      test 'returns a rating and explanation without persisting anything' do
        assert_no_difference [ 'AiJudge.count', 'QueryDocPair.count' ] do
          post ai_judge_test_prompt_url(ai_judge_id: 'new'), params: {
            system_prompt:  'You are a grocery store shopper. You like cheese. Is this a cheese?',
            llm_key:        OPENAI_VALID_KEY,
            judge_options:  {
              llm_provider:    'openai',
              llm_service_url: 'https://api.openai.com',
              llm_model:       'gpt-4o',
              llm_timeout:     30,
            },
            query_doc_pair: {
              query_text:      'cheese',
              doc_id:          'd1',
              document_fields: '{"title": "Cheddar"}',
            },
          }
        end

        assert_response :success
        body = response.parsed_body
        assert_equal 0, body['rating']
        assert_predicate body['explanation'], :present?
      end

      test 'augments the system prompt with the book scale when book_id is provided' do
        scoped_book = Book.create!(name: 'scaled book', owner: user, scale: [ 0, 1 ],
                                   scale_with_labels: { '0' => 'Not Relevant', '1' => 'Relevant' })

        post ai_judge_test_prompt_url(ai_judge_id: 'new', book_id: scoped_book.id), params: {
          system_prompt:  'You are a grocery store shopper. You like cheese. Is this a cheese?',
          llm_key:        OPENAI_VALID_KEY,
          judge_options:  {
            llm_provider:    'openai',
            llm_service_url: 'https://api.openai.com',
            llm_model:       'gpt-4o',
            llm_timeout:     30,
          },
          query_doc_pair: {
            query_text:      'cheese',
            doc_id:          'd1',
            document_fields: '{"title": "Cheddar"}',
          },
        }

        assert_response :success
        assert_requested(:post, 'https://api.openai.com/v1/chat/completions') do |req|
          req.body.include?("This book's rating scale is")
        end
      end

      test 'returns a validation error instead of running the LLM when document_fields is malformed JSON' do
        post ai_judge_test_prompt_url(ai_judge_id: 'new'), params: {
          system_prompt:  'You are a grocery store shopper. You like cheese. Is this a cheese?',
          llm_key:        OPENAI_VALID_KEY,
          judge_options:  {
            llm_provider:    'openai',
            llm_service_url: 'https://api.openai.com',
            llm_model:       'gpt-4o',
            llm_timeout:     30,
          },
          query_doc_pair: {
            query_text:      'cheese',
            doc_id:          'd1',
            document_fields: 'not valid json',
          },
        }

        assert_response :unprocessable_entity
        assert_predicate response.parsed_body['error'], :present?
        assert_not_requested(:post, 'https://api.openai.com/v1/chat/completions')
      end
    end
  end
end
