# frozen_string_literal: true

require 'test_helper'

class ScoresControllerTest < ActionController::TestCase
  let(:user) { users(:random) }
  let(:case_with_score) { cases(:case_with_score) }
  let(:score_for_try_1) { scores(:score_for_try_1) }
  let(:score_for_try_2) { scores(:score_for_try_2) }

  setup do
    @controller = ScoresController.new
    login_user user
  end

  describe 'GET index' do
    test 'lists the scores for a case the user can access' do
      get :index, params: { case_id: case_with_score.id }

      assert_response :ok
      # Fixture scores share the same updated_at, so the DB's tie-break order
      # for `order(:updated_at)` isn't guaranteed -- compare by id instead of
      # asserting a specific order among ties.
      assert_equal [ score_for_try_1, score_for_try_2 ].sort_by(&:id), assigns(:scores).to_a.sort_by(&:id)
    end

    test 'filters by scorer_id when provided' do
      other_scorer_score = scores(:score_for_first_try)
      other_scorer_score.update! case: case_with_score, scorer: scorers(:valid)

      get :index, params: { case_id: case_with_score.id, scorer_id: scorers(:valid).id }

      assert_response :ok
      assert_equal [ other_scorer_score ], assigns(:scores).to_a
    end

    describe 'a case this user cannot access' do
      let(:matt_case) { cases(:matt_case) } # owned by a different user, not public, not shared with random

      test 'renders a JSON 404 instead of crashing on a nil @case' do
        get :index, params: { case_id: matt_case.id }

        assert_response :not_found
        assert_equal 'Case not found!', response.parsed_body['message']
      end
    end
  end

  describe 'DELETE destroy_multiple' do
    test 'destroys the selected scores and redirects back to the scores list' do
      assert_difference 'case_with_score.scores.count', -1 do
        delete :destroy_multiple, params: { case_id: case_with_score.id, score_ids: [ score_for_try_1.id ] }
      end

      assert_redirected_to case_scores_path(case_with_score)
      assert_equal 'Selected scores were successfully deleted.', flash[:notice]
      assert_not Score.exists?(score_for_try_1.id)
      assert Score.exists?(score_for_try_2.id)
    end

    test 'preserves the scorer_id filter on the redirect' do
      delete :destroy_multiple, params: {
        case_id: case_with_score.id, score_ids: [ score_for_try_1.id ], scorer_id: scorers(:case_default_scorer).id
      }

      assert_redirected_to case_scores_path(case_with_score, scorer_id: scorers(:case_default_scorer).id)
    end
  end
end
