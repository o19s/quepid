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
        get :edit, params: { id: communal_scorer.id }

        assert_response :not_found
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
        put :update, params: { id: communal_scorer.id, scorer: { name: 'Hacked Name' } }

        assert_response :not_found
        assert_not_equal 'Hacked Name', communal_scorer.reload.name
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
        assert_no_difference 'Scorer.count' do
          delete :destroy, params: { id: communal_scorer.id }
        end

        assert_response :not_found
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

  describe 'update_default' do
    before do
      login_user user
    end

    test 'sets an accessible scorer as the user default' do
      post :update_default, params: { default_scorer_id: custom_scorer.id }

      assert_redirected_to scorers_path
      assert_equal 'Default scorer updated.', flash[:notice]
      assert_equal custom_scorer, user.reload.default_scorer
    end

    test 'rejects a missing scorer' do
      post :update_default, params: { default_scorer_id: -1 }

      assert_redirected_to scorers_path
      assert_equal 'Scorer not found.', flash[:alert]
    end

    test 'rejects an inaccessible scorer' do
      post :update_default, params: { default_scorer_id: scorers(:valid).id }

      assert_redirected_to scorers_path
      assert_equal 'You cannot select that scorer as default.', flash[:alert]
      assert_not_equal scorers(:valid), user.reload.default_scorer
    end

    test 'reports a failed user save' do
      user.define_singleton_method(:save) { false }
      begin
        post :update_default, params: { default_scorer_id: custom_scorer.id }
      ensure
        user.singleton_class.remove_method(:save)
      end

      assert_redirected_to scorers_path
      assert_equal user.errors.full_messages.to_sentence, flash[:alert]
    end
  end

  describe 'share' do
    before do
      login_user user
    end

    let(:team) { teams(:team_for_case_shared_with_owner) }
    let(:shareable_scorer) { scorers(:random_scorer_1) }

    test 'shares an accessible custom scorer with a team' do
      assert_not team.scorers.exists?(shareable_scorer.id)

      post :share, params: { team_id: team.id, scorer_id: shareable_scorer.id }

      assert_response :see_other
      assert_redirected_to scorers_path
      assert_includes team.reload.scorers, shareable_scorer
      assert_equal "#{shareable_scorer.name} shared with #{team.name}.", flash[:notice]
    end

    test 'reports an already-shared scorer' do
      team.scorers << shareable_scorer unless team.scorers.exists?(shareable_scorer.id)

      post :share, params: { team_id: team.id, scorer_id: shareable_scorer.id }

      assert_response :see_other
      assert_equal "#{shareable_scorer.name} is already shared with #{team.name}.", flash[:alert]
    end

    test 'rejects a missing team or scorer' do
      post :share, params: { team_id: -1, scorer_id: shareable_scorer.id }

      assert_redirected_to scorers_path
      assert_equal 'Team or scorer not found.', flash[:alert]
    end

    test 'rejects an inaccessible scorer' do
      post :share, params: { team_id: team.id, scorer_id: scorers(:valid).id }

      assert_redirected_to scorers_path
      assert_equal 'You do not have access to that scorer.', flash[:alert]
    end

    test 'rejects a communal scorer' do
      post :share, params: { team_id: team.id, scorer_id: communal_scorer.id }

      assert_redirected_to scorers_path
      assert_equal 'Communal scorers are already available to everyone.', flash[:alert]
    end
  end

  describe 'unshare' do
    before do
      login_user user
    end

    let(:team) { teams(:scorers_team) }
    let(:shared_scorer) { scorers(:random_scorer_1) }

    test 'removes a scorer from a team' do
      assert_includes team.scorers, shared_scorer

      post :unshare, params: { team_id: team.id, scorer_id: shared_scorer.id }

      assert_response :see_other
      assert_not team.reload.scorers.exists?(shared_scorer.id)
      assert_equal "#{shared_scorer.name} unshared from #{team.name}.", flash[:notice]
    end

    test 'reports a scorer that is not shared with a team' do
      post :unshare, params: { team_id: teams(:team_for_case_shared_with_owner).id, scorer_id: shared_scorer.id }

      assert_response :see_other
      assert_equal "#{shared_scorer.name} is not shared with Team for case shared with owner.", flash[:alert]
    end

    test 'rejects a communal scorer' do
      post :unshare, params: { team_id: team.id, scorer_id: communal_scorer.id }

      assert_redirected_to scorers_path
      assert_equal 'Communal scorers are already available to everyone.', flash[:alert]
    end
  end
end
