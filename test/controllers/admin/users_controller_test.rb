# frozen_string_literal: true

require 'test_helper'

module Admin
  class UsersControllerTest < ActionController::TestCase
    let(:user) { users(:doug) }

    setup do
      @controller = Admin::UsersController.new
      login_user user
    end

    test 'should get index' do
      get :index

      assert_response :success

      assert_not_nil assigns(:users)
    end

    test 'index excludes AI judges' do
      get :index

      assert_response :success
      assert_not_includes assigns(:users), users(:judge_judy)
    end

    test 'index exports users as CSV' do
      get :index, format: :csv

      assert_response :success
      assert_equal 'text/csv', response.media_type
      assert_match 'filename="quepid_users.csv"', response.headers['Content-Disposition']

      lines = response.body.lines
      assert_equal "id,name,email,email_marketing,agreed_time\n", lines.first
      assert_includes response.body, user.email
      assert_not_includes response.body, users(:judge_judy).name
    end

    test 'an authorized user should NOT gain access' do
      user = users(:random)
      login_user user

      get :index

      assert_redirected_to root_path
    end

    test 'should show user' do
      get :show, params: { id: user }

      assert_response :success
      assert_equal user, assigns(:user)
    end
    test 'should get edit' do
      get :edit, params: { id: user }

      assert_response :success
      assert_equal user, assigns(:user)
    end

    test 'cannot delete an annotation author or their score history' do
      author = users(:matt)
      annotation = Annotation.create!(user: author, message: 'Keep this history')
      score = Score.create!(case: cases(:matt_case), user: author, annotation: annotation, score: 0.5)

      assert_no_difference([ 'User.count', 'Case.count', 'Annotation.count', 'Score.count' ]) do
        delete :destroy, params: { id: author.id }
      end

      assert_response :unprocessable_content
      assert_template :edit
      assert_select '#error_explanation_attributes', text: /annotations/
      assert_equal author.id, annotation.reload.user_id
      assert_equal annotation.id, score.reload.annotation_id
      assert_equal author.id, cases(:matt_case).reload.owner_id
    end

    test 'should update user' do
      patch :update, params: { id: user, user: { email: 'blah@blah.com' } }

      assert_equal 'User was successfully updated.', flash[:notice]
      assert_redirected_to admin_user_path(assigns(:user))

      user.reload
      assert_equal 'blah@blah.com', user.email
    end

    describe 'analytics' do
      test 'posts event' do
        expects_any_ga_event_call

        perform_enqueued_jobs do
          patch :update, params: { id: user, user: { email: 'blah@blah.com' } }

          assert_redirected_to admin_user_path(assigns(:user))
        end
      end
    end

    describe 'listing' do
      test 'filters by name or email and returns JSON' do
        get :index, params: { q: 'doug@example' }, format: :json

        assert_response :success
        emails = response.parsed_body.pluck('email')
        assert_includes emails, user.email
        assert_not_includes emails, users(:random).email
      end

      test 'renders the shallow listing' do
        get :index, params: { shallow: 'true' }

        assert_response :success
        assert assigns(:shallow)
      end
    end

    test 'should show user as JSON' do
      get :show, params: { id: user }, format: :json

      assert_response :success
      assert_equal user.email, response.parsed_body['email']
    end

    test 'should get new' do
      get :new

      assert_response :success
      assert_predicate assigns(:user), :new_record?
    end

    describe 'creating a user' do
      let(:attributes) do
        { email: 'new_admin_made@example.com', name: 'New Person', password: 'secret123',
          password_confirmation: 'secret123' }
      end

      test 'creates the user and shows them' do
        assert_difference 'User.count', 1 do
          post :create, params: { user: attributes }
        end

        created = User.find_by(email: 'new_admin_made@example.com')
        assert_equal 'User was successfully created.', flash[:notice]
        assert_redirected_to admin_user_path(created)
        assert_response :see_other
        assert_not created.administrator?
      end

      test 'stores a pre-encrypted password verbatim instead of re-encrypting it' do
        post :create, params: { user:               attributes.except(:password, :password_confirmation),
                                password_encrypted: 'already-encrypted-value' }

        assert_response :see_other
        assert_equal 'already-encrypted-value', User.find_by(email: 'new_admin_made@example.com').password
      end

      test 're-renders the form with errors when the user is invalid' do
        assert_no_difference 'User.count' do
          post :create, params: { user: attributes.merge(email: 'not an email') }
        end

        assert_response :unprocessable_content
        assert_nil flash[:notice]
        assert_template :new
      end

      test 'rejects a duplicate email' do
        assert_no_difference 'User.count' do
          post :create, params: { user: attributes.merge(email: user.email) }
        end

        assert_response :unprocessable_content
        assert_nil flash[:notice]
      end
    end

    describe 'updating a user' do
      let(:target) { users(:random) }

      test 'stores a pre-encrypted password verbatim' do
        patch :update, params: { id: target, user: { name: 'Renamed' }, password_encrypted: 'encrypted-elsewhere' }

        assert_redirected_to admin_user_path(target)
        target.reload
        assert_equal 'Renamed', target.name
        assert_equal 'encrypted-elsewhere', target.password
      end

      test 'answers JSON when asked' do
        patch :update, params: { id: target, user: { name: 'Via JSON' } }, format: :json

        assert_response :ok
        assert_equal 'Via JSON', target.reload.name
      end

      test 're-renders the edit form for invalid input' do
        patch :update, params: { id: target, user: { email: 'nope' } }

        assert_response :unprocessable_content
        assert_nil flash[:notice]
        assert_template :edit
        assert_not_equal 'nope', target.reload.email
      end

      test 'reports validation errors as JSON' do
        patch :update, params: { id: target, user: { email: 'nope' } }, format: :json

        assert_response :unprocessable_content
        assert_nil flash[:notice]
        assert response.parsed_body.key?('email')
      end

      test 'can promote a user to administrator' do
        patch :update, params: { id: target, user: { administrator: true } }

        assert_predicate target.reload, :administrator?
      end
    end

    describe 'deleting a user' do
      let(:target) { users(:random_1) }

      test 'removes the user and returns to the list' do
        assert_difference 'User.count', -1 do
          delete :destroy, params: { id: target.id }
        end

        assert_redirected_to admin_users_url
        assert_response :see_other
        assert_equal 'User account was successfully deleted.', flash[:notice]
      end

      test 'answers no content as JSON' do
        delete :destroy, params: { id: target.id }, format: :json

        assert_response :no_content
        assert_not User.exists?(target.id)
      end

      test 'reports why a user who cannot be deleted was kept, as JSON' do
        author = users(:matt)
        Annotation.create!(user: author, message: 'History')

        assert_no_difference 'User.count' do
          delete :destroy, params: { id: author.id }, format: :json
        end

        assert_response :unprocessable_content
        assert_nil flash[:notice]
        assert_equal [ 'base' ], response.parsed_body.keys
        assert_match(/annotations/, response.parsed_body['base'].join)
      end
    end

    test 'returns not found for a missing user' do
      get :show, params: { id: 0 }

      assert_response :not_found
    end

    test 'assigning judgements to the anonymous user detaches them from their author' do
      author = users(:random)
      judgement_ids = author.judgements.pluck(:id)
      assert_not_empty judgement_ids

      post :assign_judgements_to_anonymous_user, params: { id: author.id }

      assert_redirected_to admin_user_path(author)
      assert_response :see_other
      assert_equal 'All judgements assigned to anonymous user.', flash[:notice]
      assert_equal 0, author.judgements.reload.count
      assert_equal [ nil ], Judgement.where(id: judgement_ids).pluck(:user_id).uniq
    end
  end
end
