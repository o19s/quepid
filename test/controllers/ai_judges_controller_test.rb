# frozen_string_literal: true

require 'test_helper'

class AiJudgesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:ai_judge) { users(:judge_judy) }
  let(:team) { teams(:shared) }

  setup do
    login_user_for_integration_test user
  end

  test 'should get new' do
    get new_team_ai_judge_url(team_id: team.id)
    assert_response :success
  end

  test 'should create ai_judge' do
    assert_difference('User.count') do
      post team_ai_judges_url(team_id: team.id),
           params: { user: {
             name: ai_judge.name, llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
           } }
    end
    assert_redirected_to team_url(id: team.id)
  end

  test 'should destroy ai_judge' do
    assert_difference('User.count', -1) do
      delete team_ai_judge_url(team_id: team.id, id: ai_judge.id)
    end

    assert_redirected_to team_url(id: team.id)
  end

  describe 'cloning an ai_judge' do
    test 'renders a pre-filled form without creating a record' do
      assert_no_difference('User.count') do
        get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)
      end

      assert_response :success
      assert_select "input[name='user[name]'][value=?]", "Clone of #{ai_judge.name}"
    end

    test 'submitting the cloned form creates a new ai_judge with the same settings' do
      get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)

      assert_difference('User.count') do
        post team_ai_judges_url(team_id: team.id),
             params: { user: {
               name: "Clone of #{ai_judge.name}", llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
             } }
      end

      clone = User.order(:id).last
      assert_equal "Clone of #{ai_judge.name}", clone.name
      assert_equal ai_judge.llm_key, clone.llm_key
      assert_predicate clone, :ai_judge?
    end

    test 'returns not found for an ai_judge id that does not belong to the team' do
      other_team_ai_judge = users(:matt)

      get clone_team_ai_judge_url(team_id: team.id, id: other_team_ai_judge.id)

      assert_response :not_found
    end
  end
end
