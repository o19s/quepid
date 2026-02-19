# frozen_string_literal: true

require 'test_helper'

class TeamsControllerTest < ActionDispatch::IntegrationTest
  before do
    @user = users(:random)
    @team = teams(:valid)
    login_user_for_integration_test @user
  end

  describe 'authorization' do
    it 'redirects with alert when accessing a team the user is not a member of' do
      inaccessible_team = teams(:owned_team) # only has team_finder_user

      get team_path(inaccessible_team)

      assert_redirected_to teams_path
      assert_equal 'Team not found.', flash[:alert]
    end

    it 'allows access to a team the user is a member of' do
      Bullet.enable = false
      get team_path(@team)
      Bullet.enable = true

      assert_response :success
    end
  end

  describe 'suggest_members' do
    it 'returns users with matching email from same teams' do
      # random user is already in the 'shared' team with random_1
      # random_1 is not in the 'valid' team, so should be suggested
      get suggest_members_team_path(@team), params: { query: 'random_1' }

      assert_response :success
      suggestions = response.parsed_body
      random_1_suggestion = suggestions.find { |s| 'random_1@example.com' == s['email'] }
      assert_not_nil random_1_suggestion
      assert_equal 'random_1@example.com', random_1_suggestion['email']
      assert random_1_suggestion.key?('name')
      assert random_1_suggestion.key?('display_name')
      assert random_1_suggestion.key?('avatar_url')
    end

    it 'returns users with matching email from same domain' do
      # autocomplete_user_1 has same domain as random user (example.com)
      autocomplete_user = users(:autocomplete_user_1)

      get suggest_members_team_path(@team), params: { query: 'autocomplete_user_1' }

      assert_response :success
      suggestions = response.parsed_body
      user_suggestion = suggestions.find { |s| s['email'] == autocomplete_user.email }
      assert_not_nil user_suggestion
      assert_equal 'autocomplete_user_1@example.com', user_suggestion['email']
    end

    it 'excludes current team members from suggestions' do
      # doug is already a member of the valid team
      existing_member = users(:doug)

      get suggest_members_team_path(@team), params: { query: 'doug' }

      assert_response :success
      suggestions = response.parsed_body
      # Should not include doug since he's already in the team
      doug_in_suggestions = suggestions.any? { |s| s['email'] == existing_member.email }
      assert_not doug_in_suggestions
    end

    it 'does not return users from different domain who are not in shared teams' do
      # autocomplete_different_domain has different domain and is not in any teams with random
      different_domain_user = users(:autocomplete_different_domain)

      get suggest_members_team_path(@team), params: { query: 'different' }

      assert_response :success
      suggestions = response.parsed_body
      different_suggestion = suggestions.any? { |s| s['email'] == different_domain_user.email }
      assert_not different_suggestion
    end

    it 'searches by name as well as email' do
      # autocomplete_user_2 has name 'Bob Searchable'
      autocomplete_user = users(:autocomplete_user_2)

      get suggest_members_team_path(@team), params: { query: 'searchable' }

      assert_response :success
      suggestions = response.parsed_body
      bob_suggestion = suggestions.find { |s| s['email'] == autocomplete_user.email }

      assert_not_nil bob_suggestion
      assert_equal 'Bob Searchable', bob_suggestion['name']
    end

    it 'returns display_name which prioritizes name over email' do
      # autocomplete_user_1 has a name set
      autocomplete_user = users(:autocomplete_user_1)

      get suggest_members_team_path(@team), params: { query: 'alice' }

      assert_response :success
      suggestions = response.parsed_body
      alice_suggestion = suggestions.find { |s| s['email'] == autocomplete_user.email }

      assert_not_nil alice_suggestion
      assert_equal 'Alice Autocomplete', alice_suggestion['display_name']
    end
  end
end
