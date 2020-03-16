# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class ScorersControllerTest < ActionController::TestCase
      let(:user) { users(:doug) }

      before do
        @controller = Api::V1::ScorersController.new

        login_user user
      end

      describe 'Creates scorer' do
        test 'sets default attributes, including owner' do
          post :create

          assert_response :ok

          scorer = json_response

          assert_not_nil scorer['scorerId']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal [],                            scorer['scale']
          assert_equal false,                         scorer['queryTest']

          regex = /Scorer/
          assert_match regex, scorer['name']

          regex = /#{Scorer.count}/
          assert_match regex, scorer['name']
        end

        test 'handles empty string names' do
          post :create, name: ''

          assert_response :ok

          scorer = json_response

          regex = /Scorer/
          assert_match regex, scorer['name']

          regex = /#{Scorer.count}/
          assert_match regex, scorer['name']
        end

        test 'accepts code as an attribute' do
          code = 'pass();'

          post :create, scorer: { code: code }

          assert_response :ok

          scorer = JSON.parse(response.body)

          assert_not_nil scorer['scorerId']
          assert_not_nil scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal code,                          scorer['code']
          assert_equal [],                            scorer['scale']
          assert_equal false,                         scorer['queryTest']

          regex = /Scorer/
          assert_match regex, scorer['name']

          regex = /#{Scorer.count}/
          assert_match regex, scorer['name']
        end

        test 'accepts name as an attribute' do
          name = 'Custom Name'

          post :create, scorer: { name: name }

          assert_response :ok

          scorer = JSON.parse(response.body)

          assert_not_nil scorer['scorerId']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal [],                            scorer['scale']
          assert_equal false,                         scorer['queryTest']

          assert_equal name, scorer['name']
        end

        test 'accepts custom scale and serializes properly' do
          scale = [ 1, 2, 3, 4 ]

          post :create, scorer: { scale: scale }

          assert_response :ok

          scorer = JSON.parse(response.body)

          assert_not_nil scorer['scorerId']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal scale,                         scorer['scale']
          assert_equal false,                         scorer['queryTest']
        end

        test 'limits scale length' do
          scale = (1..15).to_a

          post :create, scorer: { scale: scale }

          assert_response :bad_request

          result = JSON.parse(response.body)

          assert_includes result['scale'], 'must be limited to at most 10 values'
        end

        test 'limits scale to integers only' do
          scale = [ 1, 2, 3, 'foo' ]

          post :create, scorer: { scale: scale }

          assert_response :bad_request

          result = JSON.parse(response.body)

          assert_includes result['scale'], 'is invalid (only integers allowed)'
        end

        test 'sorts scale' do
          scale = [ 3, 4, 1, 2 ]

          post :create, scorer: { scale: scale }

          assert_response :ok

          scorer = JSON.parse(response.body)

          assert_not_nil scorer['scorerId']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal scale.sort,                    scorer['scale']
          assert_equal false,                         scorer['queryTest']
        end

        test 'accepts scale as a string' do
          scale = [ 1, 2, 3, 4 ]

          post :create, scorer: { scale: scale.join(',') }

          assert_response :ok

          scorer = JSON.parse(response.body)

          assert_not_nil scorer['scorerId']
          assert_nil scorer['code']
          assert_not_nil scorer['name']
          assert_equal [ 1, 2, 3, 4 ], scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal scale.sort,                    scorer['scale']
          assert_equal false,                         scorer['queryTest']
        end

        test 'sets scorer as a test for a query' do
          query = queries(:one)

          post :create, scorer: { query_id: query.id }

          assert_response :ok

          assert_not_nil  json_response['queryId']
          assert_equal    query.id, json_response['queryId']
          assert_not_nil  query.test
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              post :create

              assert_response :ok
            end
          end
        end
      end

      describe 'Fetches scorer' do
        let(:scorer)        { scorers(:valid) }
        let(:shared_scorer) { scorers(:shared_scorer) }

        test 'returns a not found error if the scorer is neither owned by the user or shared with the user' do
          get :show, id: 'foo' # for when it doesn't exist

          assert_response :not_found
        end

        test 'returns scorer owned by user' do
          get :show, id: scorer.id

          assert_response :ok

          scorer_response = JSON.parse(response.body)

          assert_equal scorer.id,         scorer_response['scorerId']
          assert_equal scorer.name,       scorer_response['name']
          assert_equal scorer.code,       scorer_response['code']
          assert_equal scorer.query_test, scorer_response['queryTest']
          assert_equal user.id,           scorer_response['owner_id']
          assert_equal true,              scorer_response['owned']
        end

        test 'returns scorer shared with user' do
          get :show, id: shared_scorer.id

          assert_response :ok

          scorer_response = JSON.parse(response.body)

          assert_equal shared_scorer.id,          scorer_response['scorerId']
          assert_equal shared_scorer.name,        scorer_response['name']
          assert_equal shared_scorer.code,        scorer_response['code']
          assert_equal shared_scorer.query_test,  scorer_response['queryTest']
          assert_not_equal user.id,               scorer_response['owner_id']
          assert_not_equal true,                  scorer_response['owned']
        end
      end

      describe 'Updates scorer' do
        let(:owned_scorer)  { scorers(:owned_scorer) }
        let(:shared_scorer) { scorers(:shared_scorer) }

        test 'return a forbidden error if updating a scorer not owned by user' do
          put :update, id: shared_scorer.id, scorer: { name: 'new name' }

          assert_response :forbidden

          error = JSON.parse(response.body)

          assert_equal error['error'], 'Cannot edit a scorer you do not own'
        end

        test 'successfully updates name' do
          name = 'Custom Name'

          put :update, id: owned_scorer.id, scorer: { name: name }

          assert_response :ok

          scorer = JSON.parse(response.body)
          owned_scorer.reload

          assert_equal name, scorer['name']
          assert_equal name, owned_scorer.name
        end

        test 'successfully updates code' do
          code = 'fail();'

          put :update, id: owned_scorer.id, scorer: { code: code }

          assert_response :ok

          scorer = JSON.parse(response.body)
          owned_scorer.reload

          assert_equal code, scorer['code']
          assert_equal code, owned_scorer.code
        end

        test 'successfully updates scale' do
          scale = [ 1, 2 ]

          put :update, id: owned_scorer.id, scorer: { scale: scale }

          assert_response :ok

          scorer = JSON.parse(response.body)
          owned_scorer.reload

          assert_equal scale, scorer['scale']
          assert_equal scale, owned_scorer.scale
        end

        test 'limits scale length' do
          scale = (1..15).to_a

          put :update, id: owned_scorer.id, scorer: { scale: scale }

          assert_response :bad_request

          result = JSON.parse(response.body)

          assert_includes result['scale'], 'must be limited to at most 10 values'
        end

        test 'limits scale to integers only' do
          scale = [ 1, 'foo' ]

          put :update, id: owned_scorer.id, scorer: { scale: scale }

          assert_response :bad_request

          result = JSON.parse(response.body)

          assert_includes result['scale'], 'is invalid (only integers allowed)'
        end

        test 'sorts scale' do
          scale = [ 2, 1 ]

          put :update, id: owned_scorer.id, scorer: { scale: scale }

          assert_response :ok

          scorer = JSON.parse(response.body)
          owned_scorer.reload

          assert_equal scale.sort, scorer['scale']
          assert_equal scale.sort, owned_scorer.scale
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            name = 'Custom Name'

            perform_enqueued_jobs do
              put :update, id: owned_scorer.id, scorer: { name: name }

              assert_response :ok
            end
          end
        end
      end

      describe 'Deletes scorer' do
        describe 'when scorer is not set as default' do
          let(:owned_scorer)  { scorers(:owned_scorer) }
          let(:shared_scorer) { scorers(:shared_scorer) }

          test 'return a forbidden error if updating a scorer not owned by user' do
            delete :destroy, id: shared_scorer.id

            assert_response :forbidden

            error = JSON.parse(response.body)

            assert_equal error['error'], 'Cannot delete a scorer you do not own'
          end

          test 'removes scorer successfully and disassociates it from owner' do
            delete :destroy, id: owned_scorer.id

            assert_response :no_content

            user.reload

            assert_not_includes user.owned_scorers, owned_scorer
          end
        end

        describe 'when scorer is set as user default' do
          let(:default_scorer)        { scorers(:default_scorer) }
          let(:default_scorer_owner)  { users(:default_scorer_owner) }
          let(:default_scorer_user)   { users(:default_scorer_user) }

          before do
            login_user default_scorer_owner
          end

          test 'returns a bad request error if nothing specified' do
            delete :destroy, id: default_scorer.id

            assert_response :bad_request
          end

          test 'returns a bad request error if not forced' do
            delete :destroy, id: default_scorer.id, force: false

            assert_response :bad_request
          end

          test 'removes default association and deletes scorer when forced' do
            delete :destroy, id: default_scorer.id, force: true

            assert_response :no_content

            default_scorer_user.reload
            default_scorer_owner.reload

            assert_not_equal  default_scorer_owner.scorer, default_scorer
            assert_nil        default_scorer_owner.scorer
            assert_nil        default_scorer_owner.scorer_id

            assert_not_equal  default_scorer_user.scorer, default_scorer
            assert_nil        default_scorer_user.scorer
            assert_nil        default_scorer_user.scorer_id

            assert_equal User.where(scorer_id: default_scorer.id).count, 0
          end
        end

        describe 'when scorer is set as case default' do
          let(:default_scorer)        { scorers(:case_default_scorer) }
          let(:user)                  { users(:random) }
          let(:acase)                 { cases(:for_default_scorer) }

          before do
            login_user user
          end

          test 'returns a bad request error if nothing specified' do
            delete :destroy, id: default_scorer.id

            assert_response :bad_request
          end

          test 'returns a bad request error if not forced' do
            delete :destroy, id: default_scorer.id, force: false

            assert_response :bad_request
          end

          test 'removes default association and deletes scorer when forced' do
            delete :destroy, id: default_scorer.id, force: true

            assert_response :no_content

            acase.reload

            assert_not_equal  acase.scorer, default_scorer
            assert_nil        acase.scorer
            assert_nil        acase.scorer_id

            assert_equal Case.where(scorer_id: default_scorer.id).count, 0
          end
        end

        describe 'when scorer is set as query default' do
          let(:default_scorer)        { scorers(:query_default_scorer) }
          let(:user)                  { users(:random) }
          let(:query)                 { queries(:for_default_scorer) }

          before do
            login_user user
          end

          test 'returns a bad request error if nothing specified' do
            delete :destroy, id: default_scorer.id

            assert_response :bad_request
          end

          test 'returns a bad request error if not forced' do
            delete :destroy, id: default_scorer.id, force: false

            assert_response :bad_request
          end

          test 'removes default association and deletes scorer when forced' do
            delete :destroy, id: default_scorer.id, force: true

            assert_response :no_content

            query.reload

            assert_not_equal  query.scorer, default_scorer
            assert_nil        query.scorer
            assert_nil        query.scorer_id

            assert_equal Query.where(scorer_id: default_scorer.id).count, 0
          end
        end

        describe 'when scorer is shared with a team' do
          let(:default_scorer)        { scorers(:random_scorer_1) }
          let(:default_scorer_team)   { teams(:scorers_team) }
          let(:user)                  { users(:random) }

          before do
            login_user user
          end

          test 'returns a bad request error if nothing specified' do
            delete :destroy, id: default_scorer.id

            assert_response :bad_request
          end
        end

        describe 'analytics' do
          let(:owned_scorer) { scorers(:owned_scorer) }

          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              delete :destroy, id: owned_scorer.id

              assert_response :no_content
            end
          end
        end
      end

      describe 'Fetches scorers' do
        let(:owned_scorer)     { scorers(:owned_scorer) }
        let(:shared_scorer)    { scorers(:shared_scorer) }

        test 'returns all scorers owned by user and those shared through teams' do
          get :index

          assert_response :ok

          scorers = JSON.parse(response.body)

          expected_owned_response = {
            'scorerId'            => owned_scorer.id,
            'scorerType'          => owned_scorer.class.to_s,
            'code'                => owned_scorer.code,
            'name'                => owned_scorer.name,
            'queryTest'           => owned_scorer.query_test,
            'scale'               => owned_scorer.scale,
            'owner_id'            => owned_scorer.owner_id,
            'owned'               => true,
            'queryId'             => nil,
            'manualMaxScore'      => false,
            'manualMaxScoreValue' => 100,
            'showScaleLabels'     => false,
            'scaleWithLabels'     => nil,
            'teams'               => [],
          }

          teams = shared_scorer.teams.map do |team|
            {
              'id'       => team.id,
              'name'     => team.name,
              'owner_id' => team.owner_id,
            }
          end

          expected_shared_response = {
            'scorerId'            => shared_scorer.id,
            'scorerType'          => shared_scorer.class.to_s,
            'code'                => shared_scorer.code,
            'name'                => shared_scorer.name,
            'queryTest'           => shared_scorer.query_test,
            'scale'               => shared_scorer.scale,
            'owner_id'            => shared_scorer.owner_id,
            'owned'               => false,
            'queryId'             => nil,
            'manualMaxScore'      => false,
            'manualMaxScoreValue' => 100,
            'showScaleLabels'     => false,
            'scaleWithLabels'     => nil,
            'teams'               => teams,
          }

          assert_includes scorers['user_scorers'], expected_owned_response
          assert_includes scorers['user_scorers'], expected_shared_response
        end
      end
    end
  end
end
