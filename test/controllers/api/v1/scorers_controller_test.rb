# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class ScorersControllerTest < ActionController::TestCase
      let(:user) { users(:doug) }

      before do
        @controller = Api::V1::ScorersController.new
        Rails.application.config.communal_scorers_only = false

        login_user user
      end

      describe 'Creates scorer' do
        test 'sets default attributes, including owner' do
          post :create

          assert_response :ok

          scorer = response.parsed_body

          assert_not_nil scorer['scorer_id']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal [],                            scorer['scale']

          regex = /Scorer/
          assert_match regex, scorer['name']

          regex = /#{Scorer.count}/
          assert_match regex, scorer['name']
        end

        test 'handles empty string names' do
          post :create, params: { name: '' }

          assert_response :ok

          scorer = response.parsed_body

          regex = /Scorer/
          assert_match regex, scorer['name']

          regex = /#{Scorer.count}/
          assert_match regex, scorer['name']
        end

        test 'accepts code as an attribute' do
          code = 'pass();'

          post :create, params: { scorer: { code: code } }

          assert_response :ok

          scorer = response.parsed_body

          assert_not_nil scorer['scorer_id']
          assert_not_nil scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal code,                          scorer['code']
          assert_equal [],                            scorer['scale']

          regex = /Scorer/
          assert_match regex, scorer['name']

          regex = /#{Scorer.count}/
          assert_match regex, scorer['name']
        end

        test 'accepts name as an attribute' do
          name = 'Custom Name'

          post :create, params: { scorer: { name: name } }

          assert_response :ok

          scorer = response.parsed_body

          assert_not_nil scorer['scorer_id']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal [],                            scorer['scale']

          assert_equal name, scorer['name']
        end

        test 'accepts custom scale and serializes properly' do
          scale = [ 1, 2, 3, 4 ]

          post :create, params: { scorer: { scale: scale } }

          assert_response :ok

          scorer = response.parsed_body

          assert_not_nil scorer['scorer_id']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal scale,                         scorer['scale']
        end

        test 'limits scale length' do
          scale = (1..15).to_a

          post :create, params: { scorer: { scale: scale } }

          assert_response :bad_request

          result = response.parsed_body

          assert_includes result['scale'], 'must be limited to at most 10 values'
        end

        test 'limits scale to integers only' do
          scale = [ 1, 2, 3, 'foo' ]

          post :create, params: { scorer: { scale: scale } }

          assert_response :bad_request

          result = response.parsed_body

          assert_includes result['scale'], 'is invalid (only integers allowed)'
        end

        test 'sorts scale' do
          scale = [ 3, 4, 1, 2 ]

          post :create, params: { scorer: { scale: scale } }

          assert_response :ok

          scorer = response.parsed_body

          assert_not_nil scorer['scorer_id']
          assert_nil     scorer['code']
          assert_not_nil scorer['name']
          assert_not_nil scorer['scale']

          assert_equal user.id,                       scorer['owner_id']
          assert_equal scale.sort,                    scorer['scale']
        end

        test 'respects communal_scorers_only environment setting' do
          Rails.application.config.communal_scorers_only = true

          post :create

          assert_response :forbidden

          error = response.parsed_body

          assert_equal error['error'], 'Communal Scorers Only!'
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
          get :show, params: { id: 'foo' } # for when it doesn't exist

          assert_response :not_found
        end

        test 'returns scorer owned by user' do
          get :show, params: { id: scorer.id }

          assert_response :ok

          scorer_response = response.parsed_body

          assert_equal scorer.id,         scorer_response['scorer_id']
          assert_equal scorer.name,       scorer_response['name']
          assert_equal scorer.code,       scorer_response['code']
          assert_equal user.id,           scorer_response['owner_id']
          assert_equal true,              scorer_response['owned']
        end

        test 'returns scorer shared with user' do
          get :show, params: { id: shared_scorer.id }

          assert_response :ok

          scorer_response = response.parsed_body

          assert_equal shared_scorer.id,          scorer_response['scorer_id']
          assert_equal shared_scorer.name,        scorer_response['name']
          assert_equal shared_scorer.code,        scorer_response['code']
          assert_not_equal user.id,               scorer_response['owner_id']
          assert_not_equal true,                  scorer_response['owned']
        end
      end

      describe 'Updates scorer' do
        let(:owned_scorer)    { scorers(:owned_scorer) }
        let(:shared_scorer)   { scorers(:shared_scorer) }
        let(:communal_scorer) { scorers(:communal_scorer) }
        let(:jane)            { users(:jane) }
        let(:admin) { users(:doug) }

        test 'return a forbidden error if updating a scorer not owned by user' do
          put :update, params: { id: shared_scorer.id, scorer: { name: 'new name' } }

          assert_response :forbidden

          error = response.parsed_body

          assert_equal error['error'], 'Cannot edit a scorer you do not own'
        end

        test 'return a forbidden error if updating a communal scorer' do
          login_user jane

          put :update, params: { id: communal_scorer.id, scorer: { name: 'new name' } }

          assert_response :forbidden

          error = response.parsed_body

          assert_equal error['error'], 'Cannot edit a scorer you do not own'
        end

        test 'lets a administrator update a communal scorer' do
          login_user admin
          name = 'Custom Name'

          put :update, params: { id: communal_scorer.id, scorer: { name: name } }

          assert_response :ok

          scorer = response.parsed_body
          communal_scorer.reload

          assert_equal name, scorer['name']
          assert_equal name, communal_scorer.name
        end

        test 'respects communal_Scorers_only environment setting' do
          Rails.application.config.communal_scorers_only = true

          put :update, params: { id: owned_scorer.id, scorer: { name: 'new name' } }
          assert_response :forbidden

          error = response.parsed_body

          assert_equal error['error'], 'Communal Scorers Only!'
        end

        test 'successfully updates name' do
          name = 'Custom Name'

          put :update, params: { id: owned_scorer.id, scorer: { name: name } }

          assert_response :ok

          scorer = response.parsed_body
          owned_scorer.reload

          assert_equal name, scorer['name']
          assert_equal name, owned_scorer.name
        end

        test 'successfully updates code' do
          code = 'fail();'

          put :update, params: { id: owned_scorer.id, scorer: { code: code } }

          assert_response :ok

          scorer = response.parsed_body
          owned_scorer.reload

          assert_equal code, scorer['code']
          assert_equal code, owned_scorer.code
        end

        test 'successfully updates scale' do
          scale = [ 1, 2 ]

          put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

          assert_response :ok

          scorer = response.parsed_body
          owned_scorer.reload

          assert_equal scale, scorer['scale']
          assert_equal scale, owned_scorer.scale
        end

        test 'limits scale length' do
          scale = (1..15).to_a

          put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

          assert_response :bad_request

          result = response.parsed_body

          assert_includes result['scale'], 'must be limited to at most 10 values'
        end

        test 'limits scale to integers only' do
          scale = [ 1, 'foo' ]

          put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

          assert_response :bad_request

          result = response.parsed_body

          assert_includes result['scale'], 'is invalid (only integers allowed)'
        end

        test 'sorts scale' do
          scale = [ 2, 1 ]

          put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

          assert_response :ok

          scorer = response.parsed_body
          owned_scorer.reload

          assert_equal scale.sort, scorer['scale']
          assert_equal scale.sort, owned_scorer.scale
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            name = 'Custom Name'

            perform_enqueued_jobs do
              put :update, params: { id: owned_scorer.id, scorer: { name: name } }

              assert_response :ok
            end
          end
        end
      end

      describe 'Deletes scorer' do
        describe 'when scorer is not set as default' do
          let(:owned_scorer)  { scorers(:owned_scorer) }
          let(:shared_scorer) { scorers(:shared_scorer) }
          let(:random_scorer) { scorers(:random_scorer) }

          test 'return a forbidden error if deleteing a scorer not accesible by user' do
            delete :destroy, params: { id: random_scorer.id }

            assert_response :not_found

            error = response.parsed_body

            assert_equal error['error'], 'Not Found!'
          end

          test 'allow you to delete a scorer shared but not owned by user' do
            shared_scorer.save!

            delete :destroy, params: { id: shared_scorer.id }

            assert_response :no_content

            user.reload

            assert_not_includes user.scorers_involved_with, shared_scorer
          end

          test 'removes scorer successfully and disassociates it from owner' do
            delete :destroy, params: { id: owned_scorer.id }

            assert_response :no_content

            user.reload

            assert_not_includes user.owned_scorers, owned_scorer
          end

          test 'respects communal_Scorers_only environment setting' do
            Rails.application.config.communal_scorers_only = true

            delete :destroy, params: { id: owned_scorer.id }
            assert_response :forbidden

            error = response.parsed_body

            assert_equal error['error'], 'Communal Scorers Only!'
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
            delete :destroy, params: { id: default_scorer.id }

            assert_response :bad_request
          end

          test 'returns a bad request error if scorer is user default' do
            delete :destroy, params: { id: default_scorer.id, force: false }

            assert_response :bad_request
          end

          test 'removes default association and deletes scorer when forced, setting the default to Quepid default' do
            delete :destroy, params: { id: default_scorer.id, force: true }

            assert_response :no_content

            default_scorer_user.reload
            default_scorer_owner.reload

            assert_not_equal  default_scorer_owner.default_scorer, default_scorer
            assert_not_nil    default_scorer_owner.default_scorer
            assert_equal      default_scorer_owner.default_scorer.name, Rails.application.config.quepid_default_scorer

            assert_not_equal  default_scorer_user.default_scorer, default_scorer
            assert_not_nil    default_scorer_user.default_scorer
            assert_equal      default_scorer_user.default_scorer, Scorer.system_default_scorer

            assert_equal User.where(default_scorer_id: default_scorer.id).count, 0
          end
        end

        describe 'when scorer is set as case default' do
          let(:default_scorer)        { scorers(:case_default_scorer) }
          let(:user)                  { users(:random) }
          let(:acase)                 { cases(:for_default_scorer) }
          let(:replacement_scorer)    { scorers(:communal_scorer) }

          before do
            login_user user
          end

          test 'returns a bad request error if nothing specified' do
            delete :destroy, params: { id: default_scorer.id }

            assert_response :bad_request
          end

          test 'returns a bad request error if not forced' do
            delete :destroy, params: { id: default_scorer.id, force: false }

            assert_response :bad_request
          end

          test 'removes default association and deletes scorer when forced, replacing with system default scorer' do
            delete :destroy, params: { id: default_scorer.id, force: true }

            assert_response :no_content

            acase.reload

            assert_not_equal  acase.scorer, default_scorer
            assert_not_nil    acase.scorer
            assert_equal      acase.scorer.name, Rails.application.config.quepid_default_scorer

            assert_equal Case.where(scorer_id: default_scorer.id).count, 0
          end

          test 'removes default association and deletes scorer when forced, updating to the new scorer' do
            delete :destroy, params: {
              id:                    default_scorer.id,
              force:                 true,
              replacement_scorer_id: replacement_scorer.id,
            }

            assert_response :no_content

            acase.reload

            assert_not_nil    acase.scorer
            assert_equal      acase.scorer, replacement_scorer

            assert_equal Case.where(scorer_id: default_scorer.id).count, 0
          end
        end

        describe 'analytics' do
          let(:owned_scorer) { scorers(:owned_scorer) }

          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              delete :destroy, params: { id: owned_scorer.id }

              assert_response :no_content
            end
          end
        end
      end

      describe 'Fetches scorers' do
        let(:owned_scorer)     { scorers(:owned_scorer) }
        let(:shared_scorer)    { scorers(:shared_scorer) }
        let(:communal_scorer)  { scorers(:quepid_default_scorer) }
        let(:shared_team)      { teams(:shared) }

        test 'returns all scorers owned by user and those shared through teams' do
          get :index

          assert_response :ok

          scorers = response.parsed_body

          expected_owned_response = {
            'name'              => owned_scorer.name,
            'scorer_id'         => owned_scorer.id,
            'communal'          => owned_scorer.communal,
            'code'              => owned_scorer.code,
            'scale'             => owned_scorer.scale,
            'owner_id'          => owned_scorer.owner_id,
            'owned'             => true,
            'owner_name'        => owned_scorer.owner.name,
            'show_scale_labels' => false,
            'scale_with_labels' => nil,
            'teams'             => [],
          }

          expected_shared_response = {
            'name'              => shared_scorer.name,
            'scorer_id'         => shared_scorer.id,
            'communal'          => owned_scorer.communal,
            'code'              => shared_scorer.code,
            'scale'             => shared_scorer.scale,
            'owner_id'          => shared_scorer.owner_id,
            'owned'             => false,
            'owner_name'        => shared_scorer.owner.name,
            'show_scale_labels' => false,
            'scale_with_labels' => nil,
            'teams'             => [ { 'id' => shared_team.id, 'name' => shared_team.name } ],
          }

          assert_includes scorers['user_scorers'], expected_owned_response
          assert_includes scorers['user_scorers'], expected_shared_response

          ids = scorers['user_scorers'].map { |s| s['scorer_id'] }

          assert_not_includes ids, communal_scorer.id
        end

        test 'respects communal_scorers_only environment setting' do
          Rails.application.config.communal_scorers_only = true

          get :index

          assert_response :ok

          scorers = response.parsed_body

          assert_empty scorers['user_scorers']
        end
      end
    end
  end
end
