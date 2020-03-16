# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class CaseScorersControllerTest < ActionController::TestCase
      let(:user) { users(:random) }

      before do
        @controller = Api::V1::CaseScorersController.new

        login_user user
      end

      describe 'Fetches scorers' do
        let(:acase)   { cases(:with_scorer) }
        let(:scorer)  { scorers(:for_case_with_scorer) }

        test 'returns all scorers owned by user and those shared through teams' do
          get :index, case_id: acase.id

          assert_response :ok

          data = JSON.parse(response.body)

          expected_response = {
            'scorerId'            => scorer.id,
            'scorerType'          => scorer.class.to_s,
            'code'                => scorer.code,
            'name'                => scorer.name,
            'queryTest'           => scorer.query_test,
            'scale'               => scorer.scale,
            'owner_id'            => scorer.owner_id,
            'owned'               => false,
            'queryId'             => scorer.query_id,
            'manualMaxScore'      => scorer.manual_max_score,
            'manualMaxScoreValue' => scorer.manual_max_score_value,
            'showScaleLabels'     => scorer.show_scale_labels,
            'scaleWithLabels'     => scorer.scale_with_labels,
            'teams'               => [],
          }

          assert_equal expected_response, data['default']
          assert_instance_of Array, data['user_scorers']
        end
      end

      describe 'Updates case scorer' do
        let(:acase)   { cases(:shared_case) }
        let(:scorer)  { scorers(:valid) }

        test 'sets a default scorer successfully' do
          put :update, case_id: acase.id, id: scorer.id

          assert_response :ok

          acase.reload
          assert_equal acase.scorer_id, scorer.id
        end

        test 'removes default scorer if id is set to 0' do
          acase.scorer = scorer
          acase.save!

          put :update, case_id: acase.id, id: 0

          assert_response :ok

          acase.reload
          assert_nil acase.scorer_id
          assert_nil acase.scorer
        end

        test 'returns an error if scorer does not exist' do
          put :update, case_id: acase.id, id: 'foo'

          assert_response :bad_request

          assert_equal json_response['scorer_id'], [ 'is not valid' ]

          acase.reload
          assert_nil acase.scorer_id
          assert_nil acase.scorer
        end
      end
    end
  end
end
