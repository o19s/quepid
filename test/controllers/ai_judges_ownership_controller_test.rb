# frozen_string_literal: true

require 'test_helper'

class AiJudgesOwnershipControllerTest < ActionDispatch::IntegrationTest
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
    assert_equal 'AI Judge was successfully created.', flash[:notice]
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
      owned_judge = AiJudge.create!(name: 'My Judge', llm_key: '1234', system_prompt: 'Judge it.', owner: user)

      get ai_judges_url

      assert_response :success
      assert_includes assigns(:ai_judges), owned_judge
      assert_includes assigns(:ai_judges), ai_judge
    end

    it 'excludes AI judges owned by, or only shared with, someone else' do
      other_user = users(:doug)
      private_judge = AiJudge.create!(name: 'Not Mine', llm_key: '1234', system_prompt: 'Judge it.', owner: other_user)

      get ai_judges_url

      assert_not_includes assigns(:ai_judges), private_judge
    end
  end

  describe 'access control' do
    it 'cannot edit an AI judge owned by, and not shared with, another user' do
      other_user = users(:doug)
      private_judge = AiJudge.create!(name: 'Not Mine', llm_key: '1234', system_prompt: 'Judge it.', owner: other_user)

      get edit_ai_judge_url(private_judge)

      assert_response :not_found
    end
  end
end

class AiJudgesOwnershipControllerTest
  test 'create and update use Turbo statuses and preserve book context on validation failure' do
    assert_no_difference('AiJudge.count') do
      post ai_judges_url, params: { book_id: books(:james_bond_movies).id, user: { name: '', system_prompt: 'Judge it.' } }
    end
    assert_response :unprocessable_content
    assert_select 'input[name="user[name]"]'
    assert_select "input[name=book_id][value='#{books(:james_bond_movies).id}']"

    owned = AiJudge.create!(name: 'Owned', owner: user, system_prompt: 'Judge it.')
    patch ai_judge_url(owned), params: { user: { name: '', system_prompt: 'changed' } }
    assert_response :unprocessable_content
    assert_equal 'Judge it.', owned.reload.system_prompt
  end

  test 'malformed options returns a retryable validation failure without saving' do
    owned = AiJudge.create!(name: 'Owned', owner: user, system_prompt: 'Judge it.')
    patch ai_judge_url(owned), params: { user: { name: 'Unsaved', options: '{bad' } }
    assert_response :unprocessable_content
    assert_equal 'Owned', owned.reload.name
    assert_select 'input[name="user[name]"]'
    assert_no_difference('AiJudge.count') do
      post ai_judges_url, params: { user: { name: 'Invalid JSON', options: '{bad', system_prompt: 'Judge it.' } }
    end
    assert_response :unprocessable_content
  end

  test 'private judges reject show update and destroy from another user' do
    owned = AiJudge.create!(name: 'Private', owner: users(:doug), system_prompt: 'Judge it.')
    get ai_judge_url(owned)
    assert_response :not_found
    patch ai_judge_url(owned), params: { user: { name: 'Changed' } }
    assert_response :not_found
    assert_no_difference('AiJudge.count') { delete ai_judge_url(owned) }
    assert_response :not_found
    assert_equal 'Private', owned.reload.name
  end

  test 'team members can edit a shared judge while inaccessible team memberships survive' do
    hidden_team = teams(:owned_team)
    ai_judge.teams << hidden_team
    patch ai_judge_url(ai_judge), params: { user: { name: 'Shared edited', team_ids: [ '' ] } }
    assert_response :see_other
    assert_equal 'Shared edited', ai_judge.reload.name
    assert_includes ai_judge.teams, hidden_team
    assert_not_includes ai_judge.teams, team
  end

  test 'cannot share a judge with an inaccessible team' do
    post ai_judges_url, params: { user: { name: 'Private', system_prompt: 'Judge it.', team_ids: [ teams(:owned_team).id ] } }
    assert_response :see_other
    assert_empty AiJudge.order(:id).last.teams
  end

  test 'legacy prompt editing is scoped to the requesting user' do
    owned = AiJudge.create!(name: 'Private', owner: users(:doug), system_prompt: 'Judge it.')
    get edit_ai_judge_prompt_url(owned)
    assert_response :not_found
    patch ai_judge_prompt_url(owned), params: { user: { system_prompt: 'Changed' }, query_doc_pair: { document_fields: '{}' } }
    assert_response :not_found
    assert_equal 'Judge it.', owned.reload.system_prompt
  end
end
