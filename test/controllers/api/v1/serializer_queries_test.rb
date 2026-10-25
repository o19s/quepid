# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class SerializerQueriesTest < ActionDispatch::IntegrationTest
      setup do
        @user = users(:doug)
        login_user_for_integration_test @user
      end

      test 'case lists use bounded latest-score preloads and preserve query counts' do
        first = create_scored_case('Query count first')
        baseline = select_count { get api_cases_path }
        4.times { |index| create_scored_case("Query count extra #{index}") }
        expanded = select_count { get api_cases_path }

        assert_response :success
        assert_equal baseline, expanded
        row = response.parsed_body['all_cases'].find { |item| item['case_id'] == first.id }
        assert_equal 1, row['queries_count']
        assert_equal first.scores.last_one.id, row['last_score']['id']
        assert_equal @user.email, row['last_score']['email']
        loaded_case = assigns(:cases).find { |item| item.id == first.id }
        assert_predicate loaded_case.association(:latest_score), :loaded?
        assert_not loaded_case.association(:scores).loaded?
      end

      test 'archived case lists do not add queries per case' do
        create_scored_case('Archived first').update!(archived: true)
        baseline = select_count { get api_cases_path, params: { archived: true } }
        4.times { |index| create_scored_case("Archived extra #{index}").update!(archived: true) }
        expanded = select_count { get api_cases_path, params: { archived: true } }

        assert_response :success
        assert_equal baseline, expanded
      end

      test 'user lookup counts owned and shared cases without queries per user' do
        first = User.create!(email: 'query-count-first@example.com', password: 'password')
        team = Team.create!(name: 'Query count membership')
        team.members << first
        team.cases << cases(:one)
        first.cases.create!(case_name: 'Owned and shared')
        baseline = select_count { get api_users_path, params: { prefix: 'query-count-' } }
        4.times { |index| User.create!(email: "query-count-#{index}@example.com", password: 'password') }
        expanded = select_count { get api_users_path, params: { prefix: 'query-count-' } }

        assert_response :success
        assert_equal baseline, expanded
        row = response.parsed_body['users'].find { |item| item['id'] == first.id }
        assert_equal first.cases_involved_with.count, row['cases_involved_with_count']
        assert_equal first.teams.count, row['teams_involved_with_count']
      end

      test 'team lists preload active cases and scorer owners without queries per team' do
        create_team('Query count first team')
        baseline = select_count { get api_teams_path }
        4.times { |index| create_team("Query count team #{index}") }
        expanded = select_count { get api_teams_path }

        assert_response :success
        assert_equal baseline, expanded
        row = response.parsed_body['teams'].find { |item| 'Query count first team' == item['name'] }
        assert_equal 1, row['cases_count']
        assert_equal 1, row['cases'].size
      end

      test 'deep team case lists batch try settings and sampled score history' do
        team = create_team('Deep query count team')
        first = team.cases.not_archived.first
        15.times { first.scores.create!(try: first.tries.first, user: @user, score: 0.5) }
        first.scores.each do |score|
          score.update!(annotation: Annotation.create!(user: @user, message: 'Sample note'))
        end
        baseline = select_count { get api_team_cases_path(team) }
        4.times do |index|
          team.cases << create_scored_case("Deep extra #{index}")
        end
        expanded = select_count { get api_team_cases_path(team) }

        assert_response :success
        assert_equal baseline, expanded
        row = response.parsed_body['cases'].find { |item| item['case_id'] == first.id }
        assert_equal 10, row['scores'].size
        assert(row['scores'].all? { |score| 'Sample note' == score['note'] })
        assert_equal 1, row['tries'].size
        assert_equal 1, row['queries_count']
      end

      private

      def create_scored_case name
        kase = @user.cases.create!(case_name: name)
        kase.queries.create!(query_text: 'test query')
        3.times { |index| kase.scores.create!(try: kase.tries.first, user: @user, score: index) }
        kase
      end

      def create_team name
        team = Team.create!(name: name)
        team.members << @user
        team.cases << create_scored_case(name)
        team.cases << @user.cases.create!(case_name: "#{name} archived", archived: true)
        team.scorers << scorers(:valid)
        team
      end

      def select_count(&)
        count = 0
        callback = lambda do |_name, _start, _finish, _id, payload|
          # Measure serializer reads separately from Pulse's bookkeeping.
          next if payload[:sql].match?(/\b(?:FROM|JOIN)\s+[`"]?rails_pulse_/i)

          count += 1 if 'SCHEMA' != payload[:name] && payload[:sql].match?(/\ASELECT/i)
        end
        ActiveSupport::Notifications.subscribed(callback, 'sql.active_record', &)
        count
      end
    end
  end
end
