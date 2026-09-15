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
    get new_ai_judge_url
    assert_response :success
  end

  test 'should get new with a team pre-selected from the team page' do
    get new_ai_judge_url(team_id: team.id)
    assert_response :success
    assert_equal [ team.id ], assigns(:ai_judge).team_ids
    assert_select "input[type=checkbox][value='#{team.id}'][checked]"
  end

  test 'should create ai_judge with no team (owner-only)' do
    assert_difference('User.count') do
      post ai_judges_url,
           params: { user: {
             name: ai_judge.name, llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
           } }
    end
    new_judge = User.order(:id).last
    assert_equal user, new_judge.owner
    assert_empty new_judge.teams
    assert_redirected_to ai_judge_url(new_judge)
  end

  test 'should create ai_judge and share it with a team in the same request' do
    assert_difference('User.count') do
      post ai_judges_url,
           params: { user: {
             name: ai_judge.name, llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt,
             team_ids: [ team.id ]
           } }
    end
    new_judge = User.order(:id).last
    assert_includes new_judge.teams, team
  end

  test 'should destroy ai_judge' do
    assert_difference('User.count', -1) do
      delete ai_judge_url(id: ai_judge.id)
    end

    assert_redirected_to ai_judges_url
  end

  describe 'index' do
    it 'lists AI judges the user owns or shares a team with' do
      owned_judge = User.create!(name: 'My Judge', llm_key: '1234', owner: user)

      get ai_judges_url

      assert_response :success
      assert_includes assigns(:ai_judges), owned_judge
      assert_includes assigns(:ai_judges), ai_judge
    end

    it 'excludes AI judges owned by, or only shared with, someone else' do
      other_user = users(:doug)
      private_judge = User.create!(name: 'Not Mine', llm_key: '1234', owner: other_user)

      get ai_judges_url

      assert_not_includes assigns(:ai_judges), private_judge
    end
  end

  describe 'access control' do
    it 'cannot edit an AI judge owned by, and not shared with, another user' do
      other_user = users(:doug)
      private_judge = User.create!(name: 'Not Mine', llm_key: '1234', owner: other_user)

      get edit_ai_judge_url(private_judge)

      assert_response :not_found
    end
  end
end
