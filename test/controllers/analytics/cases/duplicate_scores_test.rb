# frozen_string_literal: true

require 'test_helper'

module Analytics
  module Cases
    class DuplicateScoresControllerTest < ActionController::TestCase
      let(:user)        { users(:random) }
      let(:kase)        { cases(:case_with_score) }

      setup do
        @controller = Analytics::Cases::DuplicateScoresController.new
        login_user user
      end

      test 'renders the analytics layout, including the Make public/private toggle' do
        get :show, params: { case_id: kase.id }

        assert_response :ok
        assert_select 'button', text: /Make public|Make Private/
      end

      test 'groups scores by try, score, and day, surfacing a count greater than one for real duplicates' do
        try = tries(:for_case_with_score_try_1)

        Score.create!(case: kase, try:, user:, score: 65, all_rated: false)
        Score.create!(case: kase, try:, user:, score: 65, all_rated: false)

        get :show, params: { case_id: kase.id }

        assert_response :ok
        pattern = assigns(:duplicate_score_patterns).find { |dsp| dsp.try_id == try.id && 65 == dsp.score }
        assert_not_nil pattern
        assert_operator pattern.count, :>=, 2
      end
    end
  end
end
