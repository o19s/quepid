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
            get :show, params: { id: matt.email }
            assert_response :ok

            body = response.parsed_body

            assert body['email'] == matt.email
          end

          test 'returns basic user info if user exists (other user)' do
            doug = users(:doug)
            get :show, params: { id: doug.email }
            assert_response :ok

            body = response.parsed_body

            assert body['email'] == doug.email
            assert body['default_scorer_id'] == doug.default_scorer.id
          end

          test 'returns a not found error if user does not exist' do
            get :show, params: { id: 'foo' }
            assert_response :not_found
          end
        end

        describe 'when user is not signed in' do
          test 'returns an unauthorized error' do
            get :show,  params: { id: matt.email }
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
          patch :update,  params: { id: matt.email, user: { default_scorer_id: scorer.id } }

          assert_response :success
          matt.reload
          assert_equal matt.default_scorer_id, scorer.id
          assert_equal matt.default_scorer, scorer
        end

        test 'successfully remove default scorer by setting the id to 0' do
          matt.default_scorer = scorer
          matt.save!

          patch :update,  params: { id: matt.email, user: { default_scorer_id: 0 } }

          assert_response :success
          matt.reload
          assert_equal matt.default_scorer.name, Rails.application.config.quepid_default_scorer
        end

        test 'assigning a non existent scorer as default scorer' do
          matt.default_scorer = scorer
          matt.save!
          patch :update,  params: { id: matt.email, user: { default_scorer_id: 123 } }

          assert_response :bad_request

          body = response.parsed_body

          assert body['default_scorer_id'].include? 'Does not exist'
          # assert body['default_scorer_id'].include? I18n.t('activerecord.errors.models.user.attributes.default_scorer_id.existence')

          matt.reload
          assert_equal matt.default_scorer, scorer
        end
      end

      describe "Update user's company" do
        before do
          login_user matt
        end

        test 'successfully updates company' do
          patch :update,  params: { id: matt.email, user: { company: 'OSC' } }

          assert_response :success

          matt.reload
          assert 'OSC' == matt.company
        end
      end

      describe 'Lookup users' do
        describe 'when user is not an admin member' do
          let(:user) { users(:random) }

          before do
            login_user user
          end

          it 'returns an empty array' do
            get :index,  params: { email: 'manual@example.com' }

            assert_response :ok

            assert_instance_of  Array,  response.parsed_body['users']
            assert_equal        [],     response.parsed_body['users']
          end
        end
      end
      describe 'Search users' do
        describe 'when user is not an admin member' do
          let(:user) { users(:random) }

          before do
            login_user user
          end

          it 'returns a match on a email' do
            get :index, params: { prefix: 'matt@' }

            assert_response :ok

            assert_instance_of  Array,  response.parsed_body['users']
            assert_equal        1,      response.parsed_body['users'].size

            emails = response.parsed_body['users'].pluck('email')
            assert_includes emails, 'matt@example.com'
          end

          # Case Insensitive matches on name are too slow (600 ms instead of 250 ms)
          # so we are removing for now.  Someday if we have a real search index on
          # users we could put this back.
          it 'does a case insensitive match on name' do
            get :index, params: { prefix: 'Doug T' }

            assert_response :ok

            assert_instance_of  Array, response.parsed_body['users']
            assert_equal        1, response.parsed_body['users'].size

            emails = response.parsed_body['users'].pluck('email')
            assert_includes emails, 'doug@example.com'

            get :index, params: { prefix: 'DOUG' }

            assert_response :ok

            assert_instance_of  Array, response.parsed_body['users']
            assert_equal        1, response.parsed_body['users'].size

            emails = response.parsed_body['users'].pluck('email')
            assert_includes emails, 'doug@example.com'
          end
        end
      end
    end
  end
end
