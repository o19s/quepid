# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class CaseEmbeddersControllerTest < ActionController::TestCase
      let(:user)     { users(:random) }
      let(:acase)    { cases(:shared_with_team) }
      let(:embedder) { embedders(:openai_small) }

      before do
        @controller = Api::V1::CaseEmbeddersController.new
        login_user user
      end

      test 'index lists the embedders the user can pick and the current one' do
        acase.update!(embedder: embedder)

        get :index, params: { case_id: acase.id }

        assert_response :ok
        body = response.parsed_body
        assert_equal embedder.id, body['embedder_id']
        assert_equal embedder.name, body['embedder']['name']
        assert body['embedder']['accessible']
        assert_includes body['embedders'].pluck('embedder_id'), embedder.id
        assert_not_includes body['embedders'].pluck('embedder_id'), embedders(:private_ollama).id
      end

      test 'index flags a current embedder the user cannot see' do
        acase.update!(embedder: embedders(:private_ollama))

        get :index, params: { case_id: acase.id }

        assert_equal 'Private Ollama', response.parsed_body['embedder']['name']
        assert_not response.parsed_body['embedder']['accessible']
      end

      test 'update sets the embedder' do
        put :update, params: { case_id: acase.id, id: embedder.id }

        assert_response :ok
        assert_equal embedder, acase.reload.embedder
        assert_equal embedder.id, response.parsed_body['embedder_id']
      end

      test 'update with 0 removes it' do
        acase.update!(embedder: embedder)

        put :update, params: { case_id: acase.id, id: 0 }

        assert_response :ok
        assert_nil acase.reload.embedder_id
        assert_nil response.parsed_body['embedder']
      end

      test 'update refuses an embedder the user cannot see' do
        put :update, params: { case_id: acase.id, id: embedders(:private_ollama).id }

        assert_response :not_found
        assert_nil acase.reload.embedder_id
      end

      test 'update refuses an archived embedder' do
        embedder.update!(archived: true)

        put :update, params: { case_id: acase.id, id: embedder.id }

        assert_response :not_found
      end

      test 'update refuses a public case the user is not involved with' do
        login_user users(:joey)
        public_case = cases(:public_case)

        put :update, params: { case_id: public_case.id, id: embedders(:private_ollama).id }

        assert_response :not_found
        assert_nil public_case.reload.embedder_id
      end
    end
  end
end
