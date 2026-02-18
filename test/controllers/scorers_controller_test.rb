# frozen_string_literal: true

require 'test_helper'

class ScorersControllerTest < ActionController::TestCase
  let(:user) { users(:random) }
  let(:admin) { users(:admin) }
  let(:communal_scorer) { scorers(:quepid_default_scorer) }
  let(:custom_scorer) { scorers(:random_scorer) }

  before do
    @controller = ScorersController.new
  end

  describe 'index' do
    describe 'when user is not signed in' do
      test 'redirects to login' do
        get :index

        assert_redirected_to new_session_path
      end
    end

    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'returns success' do
        get :index

        assert_response :success
      end

      test 'loads scorers' do
        get :index

        assert_not_nil assigns(:scorers)
      end
    end
  end

  describe 'edit' do
    describe 'when user is not signed in' do
      test 'redirects to login' do
        get :edit, params: { id: custom_scorer.id }

        assert_redirected_to new_session_path
      end
    end

    describe 'when regular user is signed in' do
      before do
        login_user user
      end

      test 'can edit own custom scorer' do
        scorer = scorers(:random_scorer)
        scorer.update(owner: user)

        get :edit, params: { id: scorer.id }

        assert_response :success
        assert_equal scorer, assigns(:scorer)
      end

      test 'cannot edit communal scorer' do
        assert_raises(ActiveRecord::RecordNotFound) do
          get :edit, params: { id: communal_scorer.id }
        end
      end
    end

    describe 'when admin is signed in' do
      before do
        login_user admin
      end

      test 'can edit communal scorer' do
        get :edit, params: { id: communal_scorer.id }

        assert_response :success
        assert_equal communal_scorer, assigns(:scorer)
      end

      test 'can edit custom scorer' do
        scorer = Scorer.create!(name: 'Admin Custom Scorer', owner: admin, code: 'pass();', communal: false)

        get :edit, params: { id: scorer.id }

        assert_response :success
        assert_equal scorer, assigns(:scorer)
      end
    end
  end

  describe 'update' do
    describe 'when regular user is signed in' do
      before do
        login_user user
      end

      test 'can update own custom scorer' do
        scorer = scorers(:random_scorer)
        scorer.update(owner: user)
        new_name = 'Updated Scorer Name'

        put :update, params: { id: scorer.id, scorer: { name: new_name } }

        assert_redirected_to edit_scorer_path(scorer)
        scorer.reload
        assert_equal new_name, scorer.name
      end

      test 'cannot update communal scorer' do
        assert_raises(ActiveRecord::RecordNotFound) do
          put :update, params: { id: communal_scorer.id, scorer: { name: 'Hacked Name' } }
        end
      end
    end

    describe 'when admin is signed in' do
      before do
        login_user admin
      end

      test 'can update communal scorer' do
        new_name = 'Admin Updated Communal Scorer'

        put :update, params: { id: communal_scorer.id, scorer: { name: new_name } }

        assert_redirected_to edit_scorer_path(communal_scorer)
        communal_scorer.reload
        assert_equal new_name, communal_scorer.name
      end

      test 'can update custom scorer' do
        scorer = Scorer.create!(name: 'Admin Custom Scorer', owner: admin, code: 'pass();', communal: false)
        new_name = 'Admin Updated Custom Scorer'

        put :update, params: { id: scorer.id, scorer: { name: new_name } }

        assert_redirected_to edit_scorer_path(scorer)
        scorer.reload
        assert_equal new_name, scorer.name
      end

      test 'updates scorer code' do
        new_code = 'setScore(100);'

        put :update, params: { id: communal_scorer.id, scorer: { code: new_code } }

        assert_redirected_to edit_scorer_path(communal_scorer)
        communal_scorer.reload
        assert_equal new_code, communal_scorer.code
      end
    end
  end

  describe 'destroy' do
    describe 'when regular user is signed in' do
      before do
        login_user user
      end

      test 'can delete own custom scorer' do
        scorer = scorers(:random_scorer)
        scorer.update(owner: user)

        assert_difference 'Scorer.count', -1 do
          delete :destroy, params: { id: scorer.id }
        end

        assert_redirected_to scorers_path
        assert_equal 'Scorer deleted.', flash[:notice]
      end

      test 'cannot delete communal scorer' do
        assert_raises(ActiveRecord::RecordNotFound) do
          delete :destroy, params: { id: communal_scorer.id }
        end
      end
    end

    describe 'when admin is signed in' do
      before do
        login_user admin
      end

      test 'can delete communal scorer' do
        # Create a communal scorer specifically for this test
        scorer = Scorer.create!(name: 'Test Communal Scorer', communal: true, code: 'pass();')

        assert_difference 'Scorer.count', -1 do
          delete :destroy, params: { id: scorer.id }
        end

        assert_redirected_to scorers_path
        assert_equal 'Scorer deleted.', flash[:notice]
      end

      test 'can delete custom scorer' do
        scorer = Scorer.create!(name: 'Admin Custom Scorer', owner: admin, code: 'pass();', communal: false)

        assert_difference 'Scorer.count', -1 do
          delete :destroy, params: { id: scorer.id }
        end

        assert_redirected_to scorers_path
        assert_equal 'Scorer deleted.', flash[:notice]
      end
    end
  end

  describe 'create' do
    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'creates custom scorer for user' do
        assert_difference 'Scorer.count', 1 do
          post :create, params: { scorer: { name: 'My Custom Scorer', code: 'pass();' } }
        end

        scorer = Scorer.last
        assert_equal user, scorer.owner
        assert_not scorer.communal
        assert_redirected_to edit_scorer_path(scorer)
      end

      test 'cannot create communal scorer' do
        # Even if user tries to pass communal: true, it should be ignored
        post :create, params: { scorer: { name: 'Attempted Communal', code: 'pass();', communal: true } }

        scorer = Scorer.last
        assert_not scorer.communal
      end
    end
  end

  describe 'test' do
    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'returns score for custom scorer' do
        scorer = scorers(:random_scorer)
        scorer.update!(owner: user, code: File.read(Rails.root.join('db/scorers/p@10.js')))

        post :test, params: { id: scorer.id }, as: :json

        assert_response :success
        data = JSON.parse(response.body)
        assert data.key?('score'), "Response should include score: #{response.body}"
        assert data['score'].is_a?(Numeric), "Score should be numeric"
      end

      test 'uses params code when provided' do
        scorer = scorers(:random_scorer)
        scorer.update!(owner: user, code: 'setScore(99);')

        post :test, params: { id: scorer.id, code: 'setScore(42);' }, as: :json

        assert_response :success
        data = JSON.parse(response.body)
        assert_equal 42, data['score']
      end

      test 'returns error for invalid code' do
        scorer = scorers(:random_scorer)
        scorer.update!(owner: user)

        post :test, params: { id: scorer.id, code: 'throw new Error("oops");' }, as: :json

        assert_response :unprocessable_entity
        data = JSON.parse(response.body)
        assert data['error'].present?
      end

      test 'cannot access communal scorer for test (record not found)' do
        assert_raises(ActiveRecord::RecordNotFound) do
          post :test, params: { id: communal_scorer.id }, as: :json
        end
      end
    end

    describe 'when admin is signed in' do
      before do
        login_user admin
      end

      test 'can test communal scorer' do
        scorer = Scorer.create!(name: 'Test Communal', communal: true, code: 'setScore(0.5);')

        post :test, params: { id: scorer.id }, as: :json

        assert_response :success
        data = JSON.parse(response.body)
        assert_equal 0.5, data['score']
      end
    end
  end

  describe 'clone' do
    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'can clone communal scorer' do
        assert_difference 'Scorer.count', 1 do
          post :clone, params: { id: communal_scorer.id }
        end

        cloned_scorer = Scorer.last
        assert_equal user, cloned_scorer.owner
        assert_not cloned_scorer.communal
        assert_equal "Clone of #{communal_scorer.name}", cloned_scorer.name
        assert_redirected_to edit_scorer_path(cloned_scorer)
      end

      test 'can clone custom scorer' do
        assert_difference 'Scorer.count', 1 do
          post :clone, params: { id: custom_scorer.id }
        end

        cloned_scorer = Scorer.last
        assert_equal user, cloned_scorer.owner
        assert_not cloned_scorer.communal
      end
    end
  end
end
