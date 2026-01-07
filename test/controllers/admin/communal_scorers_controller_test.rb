# frozen_string_literal: true

require 'test_helper'

module Admin
  class CommunalScorersControllerTest < ActionController::TestCase
    let(:user) { users(:admin) }

    before do
      @controller = Admin::CommunalScorersController.new

      login_user user
    end

    describe 'Creates scorer' do
      test 'does NOT set default attributes except for communal flag' do
        post :create

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert scorer.communal
        assert_nil scorer.code
        assert_not_nil scorer.name
        assert_empty scorer.scale
        assert_equal '', scorer.scale_list
      end

      test 'handles empty string names' do
        post :create, params: { name: '' }

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert_not_nil scorer.name
      end

      test 'accepts code as an attribute' do
        code = 'pass();'

        post :create, params: { scorer: { code: code } }

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert_not_nil scorer.code
        assert_not_nil scorer.name
        assert_empty scorer.scale

        assert_equal code, scorer.code
      end

      test 'accepts name as an attribute' do
        name = 'Custom Name'

        post :create, params: { scorer: { name: name } }

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert_nil scorer.code
        assert_not_nil scorer.name
        assert_not_nil scorer.scale

        assert_equal name, scorer.name
      end

      test 'accepts custom scale and serializes properly' do
        scale = [ 1, 2, 3, 4 ]

        post :create, params: { scorer: { scale: scale } }

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert_nil scorer.code
        assert_not_nil scorer.name
        assert_not_nil scorer.scale
        assert scorer.communal

        assert_equal scale, scorer.scale
      end

      test 'uses the scale list property to set the scale' do
        scale = [ 1, 2, 3, 4 ]

        post :create, params: { scorer: { scale_list: scale.join(',') } }

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert_nil scorer.code
        assert_not_nil scorer.name
        assert_not_nil scorer.scale

        assert_equal scale, scorer.scale
      end

      test 'limits scale length' do
        scale = (1..15).to_a

        post :create, params: { scorer: { scale: scale } }

        scorer = assigns(:scorer)

        assert_includes scorer.errors['scale'], 'must be limited to at most 10 values'
      end

      test 'limits scale to integers only' do
        scale = [ 1, 2, 3, 'foo' ]

        post :create, params: { scorer: { scale: scale } }

        scorer = assigns(:scorer)

        assert_includes scorer.errors['scale'], 'is invalid (only integers allowed)'
      end

      test 'sorts scale' do
        scale = [ 3, 4, 1, 2 ]

        post :create, params: { scorer: { scale: scale } }

        assert_redirected_to admin_communal_scorer_path(assigns(:scorer))

        scorer = Scorer.last

        assert_nil scorer.code
        assert_not_nil scorer.name
        assert_not_nil scorer.scale

        assert_equal scale.sort, scorer.scale
      end
    end

    describe 'Updates scorer' do
      let(:owned_scorer)      { scorers(:quepid_default_scorer) }
      let(:not_owned_scorer)  { scorers(:random_scorer) }

      test 'successfully updates name' do
        name = 'Custom Name'

        put :update, params: { id: owned_scorer.id, scorer: { name: name } }

        assert_redirected_to admin_communal_scorer_path(owned_scorer)

        owned_scorer.reload

        assert_equal name, owned_scorer.name
      end

      test 'successfully updates code' do
        code = 'fail();'

        put :update, params: { id: owned_scorer.id, scorer: { code: code } }

        assert_redirected_to admin_communal_scorer_path(owned_scorer)

        owned_scorer.reload

        assert_equal code, owned_scorer.code
      end

      test 'successfully updates scale' do
        scale = [ 1, 2 ]

        put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

        assert_redirected_to admin_communal_scorer_path(owned_scorer)

        owned_scorer.reload

        assert_equal scale, owned_scorer.scale
      end

      test 'limits scale length' do
        scale = (1..15).to_a

        put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

        scorer = assigns(:scorer)

        assert_includes scorer.errors['scale'], 'must be limited to at most 10 values'
      end

      test 'limits scale to integers only' do
        scale = [ 1, 'foo' ]

        put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

        scorer = assigns(:scorer)

        assert_includes scorer.errors['scale'], 'is invalid (only integers allowed)'
      end

      test 'sorts scale' do
        scale = [ 2, 1 ]

        put :update, params: { id: owned_scorer.id, scorer: { scale: scale } }

        assert_redirected_to admin_communal_scorer_path(owned_scorer)

        owned_scorer.reload

        assert_equal scale.sort, owned_scorer.scale
      end

      test 'any admin can update any quepid scorer' do
        name = 'Custom Name'

        put :update, params: { id: not_owned_scorer.id, scorer: { name: name } }

        assert_redirected_to admin_communal_scorer_path(not_owned_scorer)

        not_owned_scorer.reload

        assert_equal name, not_owned_scorer.name
      end
    end
  end
end
