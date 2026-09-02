# frozen_string_literal: true

require 'test_helper'

class TeamsControllerTest < ActionDispatch::IntegrationTest
  before do
    @user = users(:doug)
    @team = teams(:valid)
    login_user_for_integration_test @user
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

  describe 'authorization' do
    it 'redirects when the user is not a member of the team' do
      foreign_team = teams(:another_shared_team)
      assert_not_includes foreign_team.members, @user

      get team_path(foreign_team)

      assert_redirected_to teams_path
    end

    it 'does not let a non-member rename a team' do
      foreign_team = teams(:another_shared_team)
      original_name = foreign_team.name

      post rename_team_path(foreign_team), params: { team: { name: 'Pwned' } }

      assert_redirected_to teams_path
      assert_equal original_name, foreign_team.reload.name
    end
  end

  describe 'share_case' do
    it 'shares a case the user has access to with one of their teams' do
      kase = cases(:one)
      assert_not @team.cases.exists?(kase.id)

      post share_case_teams_path, params: { team_id: @team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert @team.reload.cases.exists?(kase.id)
      assert_match(/shared with/, flash[:notice])
    end

    it 'sets an alert when the case is already shared with the team' do
      kase = cases(:shared_through_owned_team)
      assert @team.cases.exists?(kase.id)

      post share_case_teams_path, params: { team_id: @team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert_match(/already shared/, flash[:alert])
    end

    it 'sets an alert when the user does not have access to the case' do
      kase = cases(:shared_case)
      assert_not @user.cases_involved_with.exists?(id: kase.id)

      post share_case_teams_path, params: { team_id: @team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert_equal 'You do not have access to that case.', flash[:alert]
      assert_not @team.reload.cases.exists?(kase.id)
    end

    it 'sets an alert when the team does not belong to the current user' do
      foreign_team = teams(:another_shared_team)
      kase = cases(:one)

      post share_case_teams_path, params: { team_id: foreign_team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert_not foreign_team.reload.cases.exists?(kase.id)
    end
  end

  describe 'unshare_case' do
    it 'unshares a case the user has access to from one of their teams' do
      kase = cases(:shared_through_owned_team)
      assert @team.cases.exists?(kase.id)

      post unshare_case_teams_path, params: { team_id: @team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert_not @team.reload.cases.exists?(kase.id)
      assert_match(/unshared from/, flash[:notice])
    end

    it 'sets an alert when the case is not shared with the team' do
      kase = cases(:one)
      assert_not @team.cases.exists?(kase.id)

      post unshare_case_teams_path, params: { team_id: @team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert_match(/is not shared with/, flash[:alert])
    end

    it 'sets an alert when the user does not have access to the case' do
      kase = cases(:shared_case)

      post unshare_case_teams_path, params: { team_id: @team.id, case_id: kase.id }

      assert_redirected_to teams_path
      assert_equal 'You do not have access to that case.', flash[:alert]
    end
  end

  describe 'share_book' do
    it 'shares a book the user has access to with one of their teams' do
      book = books(:james_bond_movies)
      assert_not @team.books.exists?(book.id)

      post share_book_teams_path, params: { team_id: @team.id, book_id: book.id }

      assert_redirected_to teams_path
      assert @team.reload.books.exists?(book.id)
      assert_match(/shared with/, flash[:notice])
    end

    it 'sets an alert when the book is already shared with the team' do
      shared_team = teams(:shared)
      book = books(:james_bond_movies)
      assert shared_team.books.exists?(book.id)

      post share_book_teams_path, params: { team_id: shared_team.id, book_id: book.id }

      assert_redirected_to teams_path
      assert_match(/already shared/, flash[:alert])
    end

    it 'sets an alert when the user does not have access to the book' do
      book = books(:book_of_comedy_films)
      assert_not @user.books_involved_with.exists?(id: book.id)

      post share_book_teams_path, params: { team_id: @team.id, book_id: book.id }

      assert_redirected_to teams_path
      assert_equal 'You do not have access to that book.', flash[:alert]
    end
  end

  describe 'unshare_book' do
    it 'unshares a book the user has access to from one of their teams' do
      shared_team = teams(:shared)
      book = books(:james_bond_movies)
      assert shared_team.books.exists?(book.id)

      post unshare_book_teams_path, params: { team_id: shared_team.id, book_id: book.id }

      assert_redirected_to teams_path
      assert_not shared_team.reload.books.exists?(book.id)
      assert_match(/unshared from/, flash[:notice])
    end

    it 'sets an alert when the book is not shared with the team' do
      book = books(:james_bond_movies)
      assert_not @team.books.exists?(book.id)

      post unshare_book_teams_path, params: { team_id: @team.id, book_id: book.id }

      assert_redirected_to teams_path
      assert_match(/is not shared with/, flash[:alert])
    end
  end

  describe 'share_search_endpoint' do
    it 'shares a search endpoint the user has access to with one of their teams' do
      search_endpoint = search_endpoints(:one)
      assert_not @team.search_endpoints.exists?(search_endpoint.id)

      post share_search_endpoint_teams_path, params: { team_id: @team.id, search_endpoint_id: search_endpoint.id }

      assert_redirected_to teams_path
      assert @team.reload.search_endpoints.exists?(search_endpoint.id)
      assert_match(/shared with/, flash[:notice])
    end

    it 'sets an alert when the search endpoint is already shared with the team' do
      shared_team = teams(:shared)
      search_endpoint = search_endpoints(:one)
      assert shared_team.search_endpoints.exists?(search_endpoint.id)

      post share_search_endpoint_teams_path, params: { team_id: shared_team.id, search_endpoint_id: search_endpoint.id }

      assert_redirected_to teams_path
      assert_match(/already shared/, flash[:alert])
    end

    it 'sets an alert when the user does not have access to the search endpoint' do
      search_endpoint = search_endpoints(:two)
      assert_not @user.search_endpoints_involved_with.exists?(id: search_endpoint.id)

      post share_search_endpoint_teams_path, params: { team_id: @team.id, search_endpoint_id: search_endpoint.id }

      assert_redirected_to teams_path
      assert_equal 'You do not have access to that search endpoint.', flash[:alert]
    end
  end

  describe 'unshare_search_endpoint' do
    it 'unshares a search endpoint the user has access to from one of their teams' do
      shared_team = teams(:shared)
      search_endpoint = search_endpoints(:one)
      assert shared_team.search_endpoints.exists?(search_endpoint.id)

      post unshare_search_endpoint_teams_path, params: { team_id: shared_team.id, search_endpoint_id: search_endpoint.id }

      assert_redirected_to teams_path
      assert_not shared_team.reload.search_endpoints.exists?(search_endpoint.id)
      assert_match(/unshared from/, flash[:notice])
    end

    it 'sets an alert when the search endpoint is not shared with the team' do
      search_endpoint = search_endpoints(:one)
      assert_not @team.search_endpoints.exists?(search_endpoint.id)

      post unshare_search_endpoint_teams_path, params: { team_id: @team.id, search_endpoint_id: search_endpoint.id }

      assert_redirected_to teams_path
      assert_match(/is not shared with/, flash[:alert])
    end
  end

  describe 'archive_case' do
    it 'archives a case associated with the team and assigns the current user as owner' do
      kase = cases(:shared_through_owned_team)
      assert @team.cases.exists?(kase.id)
      assert_not kase.archived

      post archive_case_team_path(@team, case_id: kase.id)

      assert_redirected_to team_path(@team)
      kase.reload
      assert kase.archived
      assert_equal @user, kase.owner
      assert_match(/archived/, flash[:notice])
    end

    it 'sets an alert when the case is not associated with the team' do
      kase = cases(:shared_case)

      post archive_case_team_path(@team, case_id: kase.id)

      assert_redirected_to team_path(@team)
      assert_match(/is not associated with this team/, flash[:alert])
      assert_not kase.reload.archived
    end
  end

  describe 'unarchive_case' do
    it 'unarchives a case associated with the team' do
      kase = cases(:shared_through_owned_team)
      kase.update!(archived: true)
      assert @team.cases.exists?(kase.id)

      post unarchive_case_team_path(@team, case_id: kase.id)

      assert_redirected_to team_path(@team)
      assert_not kase.reload.archived
      assert_match(/unarchived/, flash[:notice])
    end

    it 'sets an alert when the case is not associated with the team' do
      kase = cases(:shared_case)

      post unarchive_case_team_path(@team, case_id: kase.id)

      assert_redirected_to team_path(@team)
      assert_match(/is not associated with this team/, flash[:alert])
    end
  end

  describe 'archive_search_endpoint' do
    it 'archives a search endpoint associated with the team and assigns the current user as owner' do
      shared_team = teams(:shared)
      search_endpoint = search_endpoints(:one)
      login_user_for_integration_test @user
      assert shared_team.search_endpoints.exists?(search_endpoint.id)
      assert_not search_endpoint.archived

      post archive_search_endpoint_team_path(shared_team, search_endpoint_id: search_endpoint.id)

      assert_redirected_to team_path(shared_team)
      search_endpoint.reload
      assert search_endpoint.archived
      assert_equal @user, search_endpoint.owner
      assert_match(/archived/, flash[:notice])
    end

    it 'sets an alert when the search endpoint is not associated with the team' do
      search_endpoint = search_endpoints(:one)

      post archive_search_endpoint_team_path(@team, search_endpoint_id: search_endpoint.id)

      assert_redirected_to team_path(@team)
      assert_match(/is not associated with this team/, flash[:alert])
      assert_not search_endpoint.reload.archived
    end
  end

  describe 'unarchive_search_endpoint' do
    it 'unarchives a search endpoint associated with the team' do
      shared_team = teams(:shared)
      search_endpoint = search_endpoints(:one)
      search_endpoint.update!(archived: true)

      post unarchive_search_endpoint_team_path(shared_team, search_endpoint_id: search_endpoint.id)

      assert_redirected_to team_path(shared_team)
      assert_not search_endpoint.reload.archived
      assert_match(/unarchived/, flash[:notice])
    end

    it 'sets an alert when the search endpoint is not associated with the team' do
      search_endpoint = search_endpoints(:one)

      post unarchive_search_endpoint_team_path(@team, search_endpoint_id: search_endpoint.id)

      assert_redirected_to team_path(@team)
      assert_match(/is not associated with this team/, flash[:alert])
    end
  end

  describe 'remove_case' do
    it 'removes a case associated with the team' do
      kase = cases(:shared_through_owned_team)
      assert @team.cases.exists?(kase.id)

      delete case_team_path(@team, case_id: kase.id)

      assert_redirected_to team_path(@team)
      assert_not @team.reload.cases.exists?(kase.id)
      assert_match(/removed from the team/, flash[:notice])
    end

    it 'sets an alert when the case is not associated with the team' do
      kase = cases(:shared_case)

      delete case_team_path(@team, case_id: kase.id)

      assert_redirected_to team_path(@team)
      assert_match(/is not associated with this team/, flash[:alert])
    end
  end

  describe 'add_member' do
    it 'adds an existing user to the team' do
      new_member = users(:random_1)
      assert_not @team.members.exists?(new_member.id)

      post members_team_path(@team), params: { email: new_member.email }

      assert_redirected_to team_path(@team)
      assert @team.reload.members.exists?(new_member.id)
      assert_match(/added to the team/, flash[:notice])
    end

    it 'sets an alert when the user is already a member' do
      post members_team_path(@team), params: { email: @user.email }

      assert_redirected_to team_path(@team)
      assert_match(/is already a member of this team/, flash[:alert])
    end

    it 'sets an alert when no user is found and signups are disabled' do
      original_signup_enabled = Rails.application.config.signup_enabled
      Rails.application.config.signup_enabled = false

      post members_team_path(@team), params: { email: 'nobody@example.com' }

      assert_redirected_to team_path(@team)
      assert_match(/Signups are disabled/, flash[:alert])
    ensure
      Rails.application.config.signup_enabled = original_signup_enabled
    end

    it 'invites a new user and adds them to the team when signups are enabled' do
      original_signup_enabled = Rails.application.config.signup_enabled
      Rails.application.config.signup_enabled = true

      assert_difference('User.count', 1) do
        post members_team_path(@team), params: { email: 'brand-new-member@example.com' }
      end

      assert_redirected_to team_path(@team)
      invited_member = User.find_by(email: 'brand-new-member@example.com')
      assert_not_nil invited_member
      assert @team.reload.members.exists?(invited_member.id)
    ensure
      Rails.application.config.signup_enabled = original_signup_enabled
    end
  end

  describe 'remove_member' do
    it 'removes a member from the team' do
      shared_team = teams(:shared)
      member = users(:random)
      assert shared_team.members.exists?(member.id)

      delete member_team_path(shared_team, member_id: member.id)

      assert_redirected_to team_path(shared_team)
      assert_not shared_team.reload.members.exists?(member.id)
      assert_match(/removed from the team/, flash[:notice])
    end

    it 'sets an alert when the user is not a member of the team' do
      non_member = users(:random)
      assert_not @team.members.exists?(non_member.id)

      delete member_team_path(@team, member_id: non_member.id)

      assert_redirected_to team_path(@team)
      assert_match(/is not a member of this team/, flash[:alert])
    end
  end
end
