# frozen_string_literal: true

require 'test_helper'

class CaseAnnotationsControllerTest < ActionController::TestCase
  before do
    @controller = CaseAnnotationsController.new
    login_user users(:random)
  end

  test 'renders persisted rows with escaped messages and two-decimal scores' do
    annotation = annotations(:one)
    annotation.update!(message: '<script>alert("x")</script>', source: '<b>import</b>')
    annotation.score.update!(score: 0.08723905360685648)

    get :index, params: { case_id: annotation.case.id }

    assert_response :success
    assert_equal 'text/html', response.media_type
    assert_select "li.annotation[data-annotation-id='#{annotation.id}']" do
      assert_select '.annotation-message', text: annotation.message
      assert_select '.annotation-score', text: 'Score: 0.09'
      assert_select '.annotation-source', text: 'by <b>import</b>'
    end
    assert_select 'script', count: 0
    assert_select '.annotation-source b', count: 0
  end

  test 'captures the submitted browser score and returns a rendered row' do
    acase = cases(:score_case)
    first_try = tries(:first_try_for_score_case)
    assert_difference [ 'Annotation.count', 'Score.count' ] do
      post :create, params: {
        case_id:    acase.id,
        annotation: { message: 'Captured score' },
        score:      { score: 0.62, all_rated: true, try_id: first_try.id, queries: { '11' => { score: 1 } } },
      }
    end
    assert_response :success
    assert_select '.annotation-message', text: 'Captured score'
    assert_select '.annotation-score', text: 'Score: 0.62'
    annotation = acase.annotations.first
    assert_equal users(:random), annotation.user
    assert_equal first_try.id, annotation.score.try_id
    # The existing JSON API permits an array here; browser hash payloads are filtered.
    assert_nil annotation.score.queries
  end

  test 'updates and deletes a case-scoped annotation' do
    annotation = annotations(:one)
    put :update, params: { case_id: annotation.case.id, id: annotation.id, annotation: { message: 'Edited' } }
    assert_response :success
    assert_select '.annotation-message', text: 'Edited'
    assert_equal 'Edited', annotation.reload.message

    assert_difference [ 'Annotation.count', 'Score.count' ], -1 do
      delete :destroy, params: { case_id: annotation.case.id, id: annotation.id }
    end
    assert_response :no_content
  end

  test 'rejects inaccessible cases and annotations outside the requested case' do
    login_user users(:doug)
    get :index, params: { case_id: cases(:score_case).id }
    assert_response :not_found

    login_user users(:random)
    annotation = annotations(:one)
    put :update, params: { case_id: cases(:score_case).id, id: annotation.id, annotation: { message: 'Forbidden' } }
    assert_response :not_found
    assert_equal 'Original Message', annotation.reload.message
  end

  test 'rejects missing annotation params before creating a score' do
    assert_no_difference 'Score.count' do
      assert_raises ActionController::ParameterMissing do
        post :create, params: { case_id: cases(:score_case).id, score: { score: 1 } }
      end
    end
  end
end
