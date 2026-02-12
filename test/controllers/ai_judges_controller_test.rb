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
end
