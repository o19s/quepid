# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class EmbeddersControllerTest < ActionController::TestCase
      let(:user) { users(:random) }
      let(:embedder) { embedders(:openai_small) }
      let(:team) { teams(:shared) }

      before do
        @controller = Api::V1::EmbeddersController.new
        login_user user
      end

      test 'index lists visible embedders and masks keys' do
        get :index, format: :json

        assert_response :ok
        names = response.parsed_body['embedders'].pluck('name')
        assert_includes names, embedder.name
        assert_not_includes names, embedders(:private_ollama).name
        assert_not_includes response.body, 'sk-test-openai'
        assert_equal Embedder::MASKED_API_KEY, response.parsed_body['embedders'].first['api_key']
      end

      test 'index filters by team' do
        get :index, params: { team_id: team.id }, format: :json

        assert_equal [ embedder.id ], response.parsed_body['embedders'].pluck('embedder_id')
      end

      test 'show returns not found for an embedder the user cannot see' do
        get :show, params: { id: embedders(:private_ollama).id }, format: :json

        assert_response :not_found
      end

      test 'create' do
        assert_difference 'Embedder.count' do
          post :create, format: :json, params: { embedder: {
            name: 'Ollama', provider: 'ollama', service_url: 'http://ollama:11434', model: 'nomic-embed-text',
            team_ids: [ team.id ]
          } }
        end

        assert_response :ok
        created = Embedder.find(response.parsed_body['embedder_id'])
        assert_equal user, created.owner
        assert_equal [ team ], created.teams.to_a
      end

      test 'create returns errors' do
        post :create, format: :json, params: { embedder: { name: 'Bad', provider: 'nope' } }

        assert_response :bad_request
        assert_predicate response.parsed_body['provider'], :present?
      end

      test 'update keeps the key when the masked value is sent back' do
        put :update, format: :json, params: { id: embedder.id, embedder: { name: 'Renamed', api_key: Embedder::MASKED_API_KEY } }

        assert_response :ok
        embedder.reload
        assert_equal 'Renamed', embedder.name
        assert_equal 'sk-test-openai', embedder.api_key
      end

      test 'destroy' do
        assert_difference 'Embedder.count', -1 do
          delete :destroy, params: { id: embedder.id }, format: :json
        end

        assert_response :no_content
      end
    end
  end
end
