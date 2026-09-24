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

      test 'a rating this book would reject is shown as unrateable, not as a usable rating' do
        # the book's scale is 0,1 and the judge answers 3
        stub_request(:post, 'https://api.openai.com/v1/chat/completions')
          .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" })
          .to_return(status: 200,
                     body:   { choices: [ { message: { content: '{"judgment": 3, "explanation": "Perfect"}' } } ] }.to_json, headers: {})

        assert_no_difference 'Judgement.count' do
          post ai_judge_test_prompt_url(ai_judge_id: 'new', book_id: book.id), params: {
            system_prompt:  'Judge this',
            llm_key:        OPENAI_VALID_KEY,
            judge_options:  { llm_provider: 'openai', llm_service_url: 'https://api.openai.com', llm_model: 'gpt-4o' },
            query_doc_pair: { query_text: 'what year was this released?', doc_id: 'goldeneye', document_fields: '{}' },
          }
        end

        assert_response :success
        body = response.parsed_body
        assert body['unrateable']
        assert_nil body['rating']
        assert_match(/outside this book's scale/, body['explanation'])
      end

      test 'a rating on the book scale is still shown as the rating' do
        stub_request(:post, 'https://api.openai.com/v1/chat/completions')
          .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" })
          .to_return(status: 200,
                     body:   { choices: [ { message: { content: '{"judgment": 1, "explanation": "Relevant"}' } } ] }.to_json, headers: {})

        post ai_judge_test_prompt_url(ai_judge_id: 'new', book_id: book.id), params: {
          system_prompt:  'Judge this',
          llm_key:        OPENAI_VALID_KEY,
          judge_options:  { llm_provider: 'openai', llm_service_url: 'https://api.openai.com', llm_model: 'gpt-4o' },
          query_doc_pair: { query_text: 'what year was this released?', doc_id: 'goldeneye', document_fields: '{}' },
        }

        assert_response :success
        body = response.parsed_body
        assert_not body['unrateable']
        assert_in_delta(1.0, body['rating'])
      end

      test 'refuses to preview a judge that needs a book when there is no book, and says where to go' do
        post ai_judge_test_prompt_url(ai_judge_id: 'new'), params: {
          system_prompt:  'Judge this',
          llm_key:        'abc123',
          judge_options:  { llm_provider: 'typesafe_jev' },
          query_doc_pair: { query_text: 'cheese', doc_id: 'd1', document_fields: '{}' },
        }

        assert_response :unprocessable_content
        assert_match(/can only be tested from a book/, response.parsed_body['error'])
        assert_match(/Judgement Stats/, response.parsed_body['error'])
        assert_not_requested(:post, /api\.typesafe\.ai/)
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
