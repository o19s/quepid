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

      describe 'with a connection' do
        let(:voyage) { connections(:voyage) }

        test 'create on a connection returns its provider and URL, and masks the connection\'s key' do
          post :create, params: { embedder: { name: 'On Voyage', model: 'voyage-3.5', connection_id: voyage.id } }, format: :json

          assert_response :ok
          body = response.parsed_body
          assert_equal voyage.id, body['connection_id']
          assert_equal 'voyage', body['provider']
          assert_equal 'https://api.voyageai.com', body['service_url']
          assert_equal Embedder::MASKED_API_KEY, body['api_key']
          assert_not_includes response.body, 'pa-test-voyage'
        end

        test 'create refuses a connection the user cannot use' do
          assert_no_difference -> { Embedder.count } do
            post :create, params: { embedder: { name: 'x', model: 'm', connection_id: connections(:private_ollama).id } }, format: :json
          end

          assert_response :bad_request
          assert_includes response.parsed_body['connection'].join, "isn't one you can use"
        end

        test 'update can move to another connection but not unlink it' do
          embedder.update!(connection: connections(:openai))

          patch :update, params: { id: embedder.id, embedder: { connection_id: '' } }, format: :json

          assert_response :bad_request
          assert_includes response.parsed_body['connection'].join, 'can be changed but not removed'
          assert_equal connections(:openai), embedder.reload.connection
        end

        test 'an embedder from before connections can be updated without one' do
          patch :update, params: { id: embedder.id, embedder: { name: 'Renamed' } }, format: :json

          assert_response :ok
          assert_equal 'Renamed', embedder.reload.name
        end

        test 'create needs a connection or settings of its own' do
          post :create, params: { embedder: { name: 'x', provider: 'openai', model: 'm' } }, format: :json

          assert_response :bad_request
          assert_includes response.parsed_body['connection'].join, 'is required'
        end
      end
    end
  end
end
