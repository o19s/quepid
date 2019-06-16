# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class UsersControllerTest < ActionController::TestCase
      let(:matt) { users(:matt) }

      before do
        @controller = Api::V1::UsersController.new
      end

      describe 'Fetch user info' do
        describe 'when user is signed in' do
          before do
            login_user matt
          end

          test 'returns basic user info if user exists (self)' do
            @request.headers['Accept'] = 'application/vnd.quepid+json; version=1'
            get :show, id: matt.username
            assert_response :ok

            body = JSON.parse(response.body)

            assert body['username'] == matt.username
          end

          test 'returns basic user info if user exists (other user)' do
            doug = users(:doug)

            get :show, id: doug.username
            assert_response :ok

            body = JSON.parse(response.body)

            assert body['username'] == doug.username
            assert body['scorerId'] == doug.scorer.id
          end

          test 'returns a not found error if user does not exist' do
            get :show, id: 'foo'
            assert_response :not_found
          end
        end

        describe 'when user is not signed in' do
          test 'returns an unauthorized error' do
            get :show, id: matt.username
            assert_response :unauthorized
          end
        end
      end

      describe "Update user's default scorer" do
        let(:scorer) { scorers(:valid) }

        before do
          login_user matt
        end

        test 'successfully updates default scorer' do
          patch :update, id: matt.username, user: { scorer_id: scorer.id }

          assert_response :success
          matt.reload
          assert matt.scorer_id == scorer.id
          assert matt.scorer    == scorer
        end

        test 'successfully remove default scorer' do
          matt.scorer = scorer
          matt.save!

          patch :update, id: matt.username, user: { scorer_id: nil }

          assert_response :success
          matt.reload
          assert matt.scorer_id.nil?
          assert matt.scorer.nil?
        end

        test 'successfully remove default scorer by setting the id to 0' do
          matt.scorer = scorer
          matt.save!

          patch :update, id: matt.username, user: { scorer_id: 0 }

          assert_response :success
          matt.reload
          assert matt.scorer_id.nil?
          assert matt.scorer.nil?
        end

        test 'assigning a non existent scorer as default scorer' do
          patch :update, id: matt.username, user: { scorer_id: 123 }

          assert_response :bad_request

          body = JSON.parse(response.body)
          assert body['scorer_id'].include? I18n.t('activerecord.errors.models.user.attributes.scorer_id.existence')

          matt.reload
          assert matt.scorer_id.nil?
          assert matt.scorer.nil?
        end
      end

      describe "Update user's company" do
        before do
          login_user matt
        end

        test 'successfully updates company' do
          patch :update, id: matt.username, user: { company: 'OSC' }

          assert_response :success

          matt.reload
          assert 'OSC' == matt.company
        end
      end

      describe 'Search users' do
        describe 'when user is not an admin member' do
          let(:user) { users(:random) }

          before do
            login_user user
          end

          it 'returns an empty array' do
            get :index, username: 'manual'

            assert_response :ok

            assert_instance_of  Array,  json_response['users']
            assert_equal        [],     json_response['users']
          end
        end
      end
    end
  end
end
