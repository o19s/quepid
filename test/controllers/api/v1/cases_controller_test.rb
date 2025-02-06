# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class CasesControllerTest < ActionController::TestCase
      let(:doug) { users(:doug) }

      before do
        @controller = Api::V1::CasesController.new

        login_user doug
      end

      describe 'Creating a case' do
        let(:joe) { users(:joe) }

        before do
          login_user joe
        end

        test "successfully creates a case and adds it to the user's case list" do
          count     = joe.cases.count
          case_name = 'test case'

          post :create, params: { case: { case_name: case_name } }

          assert_response :ok

          assert_equal response.parsed_body['case_name'], case_name
          assert_equal joe.cases.count,            count + 1
          assert_equal joe.cases.first.case_name,  case_name
        end

        test 'requires a case name' do
          post :create, params: { case: { case_name: '' } }

          assert_response :bad_request

          body = response.parsed_body
          assert body['case_name'].include? "can't be blank"
        end

        test 'creates an initial defaults try' do
          case_name = 'test case'

          post :create, params: { case: { case_name: case_name } }

          assert_response :ok

          assert_equal response.parsed_body['case_name'], case_name
          acase = Case.where(case_name: case_name).first

          assert_equal 1, acase.tries.count
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            case_name = 'test case'

            perform_enqueued_jobs do
              post :create, params: { case: { case_name: case_name } }

              assert_response :ok
            end
          end
        end
      end

      describe 'Fetching a case' do
        let(:the_case)            { cases(:one) }
        let(:matt_case)           { cases(:matt_case) }
        let(:case_with_two_tries) { cases(:case_with_two_tries) }
        let(:joey)                { users(:joey) }
        let(:public_case)         { cases(:public_case) }

        test "returns a not found error if the case is not in the signed in user's case list" do
          get :show, params: { case_id: matt_case.id }
          assert_response :not_found
        end

        test 'returns case info for a public case' do
          get :show, params: { case_id: public_case.id }
          assert_response :ok

          body = response.parsed_body

          assert_equal body['case_name'], public_case.case_name
          assert_equal body['case_id'],   public_case.id
          assert_equal body['public'],    true
        end

        test 'returns case info for a regular case' do
          get :show, params: { case_id: the_case.id }
          assert_response :ok

          body = response.parsed_body

          assert_equal body['case_name'], the_case.case_name
          assert_equal body['case_id'],   the_case.id
          assert_equal body['public'],    false
        end

        test 'returns tries from newest to oldest' do
          login_user joey

          get :show, params: { case_id: case_with_two_tries.id }
          assert_response :ok

          body = response.parsed_body

          assert_equal body['tries'][0]['try_number'], 2
          assert_equal body['tries'][1]['try_number'], 1
        end
      end

      describe 'Score history for case' do
        let(:the_case) { cases(:one) }

        before do
          get :show, params: { case_id: the_case.id }
          @body = response.parsed_body
        end

        test 'shows score history' do
          assert_not_empty @body['scores']
        end

        test 'only returns the last 10 scores' do
          assert the_case.scores.count > 10
          assert 10 == @body['scores'].count, 'limit to 10 scores'
        end

        test 'returns the most recent scores' do
          oldest_score = scores(:one)
          @body['scores'].each do |s|
            assert s['id'] != oldest_score.id
          end
        end

        test 'keeps the scorer response small' do
          score = @body['scores'].first
          score_fields = %w[updated_at score note]
          assert_empty score_fields - score.keys, 'missing fields in score response'
          assert_empty score.keys - score_fields, 'too many fields in score response'
        end
      end

      describe 'Archiving a case' do
        describe 'when it is the last/only case' do
          let(:matt)      { users(:matt) }
          let(:the_case)  { cases(:matt_case) }

          before do
            login_user matt
          end

          test 'is perfectly okay, which is a different than before!' do
            post :update, params: { case_id: the_case.id, case: { archived: true } }

            assert_response :ok
          end
        end

        describe 'when it is not the last/only case' do
          let(:one) { cases(:one) }

          test 'successfully marks case as archived' do
            count_unarchived  = doug.cases.where(archived: false).count
            count_archived    = doug.cases.where(archived: true).count

            put :update, params: { case_id: one.id, case: { archived: true } }
            assert_response :ok

            assert_equal count_unarchived - 1,  doug.cases.where(archived: false).count
            assert_equal count_archived + 1,    doug.cases.where(archived: true).count
          end
        end

        describe 'archiving user takes over ownership of a case' do
          let(:shared_team_case)  { cases(:shared_team_case) }
          let(:matt_case)         { cases(:matt_case) }
          let(:team_member_1)     { users(:team_member_1) }
          let(:team_member_1)     { users(:team_member_1) }

          before do
            login_user team_member_1
          end

          test 'let team_member_1 archive team_owner case even though he is not the owner' do
            # Make sure the team member doesn't own the case.
            # assert_not_includes team_member_1.owned_team_cases, shared_team_case
            assert_not_equal shared_team_case, shared_team_case.owner
            # make sure the team member IS involved with case via team membership however.
            assert_includes team_member_1.cases_involved_with, shared_team_case

            put :update, params: { case_id: shared_team_case.id, case: { archived: true } }
            assert_response :ok

            team_member_1.reload
            shared_team_case.reload

            # assert_includes team_member_1.owned_team_cases, shared_team_case
            assert_equal team_member_1, shared_team_case.owner
          end

          test 'prevent team_member_1 archive matt_case since he isnt invovled with the case' do
            # Make sure the team member doesn't own the case.
            # assert_not_includes team_member_1.owned_team_cases, matt_case
            assert_not_includes team_member_1.shared_team_cases, matt_case
            # make sure the team member isn't involved with case via team membership however.
            assert_not_includes team_member_1.cases_involved_with, matt_case

            put :update, params: { case_id: matt_case.id, case: { archived: true } }
            assert_response :not_found

            team_member_1.reload
            shared_team_case.reload

            # assert_not_includes team_member_1.owned_team_cases, matt_case
            assert_not_equal team_member_1, matt_case.owner
          end
        end

        describe 'analytics' do
          let(:one) { cases(:one) }

          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              put :update, params: { case_id: one.id, case: { archived: true } }
              assert_response :ok
            end
          end
        end
      end

      describe 'Deleting a case' do
        describe 'when it is the last/only case' do
          let(:matt)      { users(:matt) }
          let(:the_case)  { cases(:matt_case) }

          before do
            login_user matt
          end

          test 'is perfectly okay, it was old orthodoxy that every user has a case' do
            delete :destroy, params: { case_id: the_case.id }
            assert_response :no_content
          end
        end

        describe 'when it is not the last/only case' do
          let(:one) { cases(:one) }

          test 'successfully deletes the case' do
            count_cases = doug.cases.count

            delete :destroy, params: { case_id: one.id }
            assert_response :no_content

            doug.cases.reload
            assert_equal count_cases - 1, doug.cases.count
          end
        end

        describe 'analytics' do
          let(:one) { cases(:one) }

          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              delete :destroy, params: { case_id: one.id }
              assert_response :no_content
            end
          end
        end
      end

      describe 'Updating cases' do
        let(:one) { cases(:one) }

        describe 'when case does not exist' do
          test 'returns not found error' do
            patch :update, params: { case_id: 'foo', case_name: 'foo' }
            assert_response :not_found
          end
        end

        describe 'when changing the case name' do
          test 'updates name successfully using PATCH verb' do
            patch :update, params: { case_id: one.id, case: { case_name: 'New Name' } }
            assert_response :ok

            one.reload
            assert_equal one.case_name, 'New Name'
          end

          test 'updates name successfully using PUT verb' do
            put :update, params: { case_id: one.id, case: { case_name: 'New Name' } }
            assert_response :ok

            one.reload
            assert_equal one.case_name, 'New Name'
          end
        end

        describe 'when unarchiving the case' do
          before do
            one.mark_archived!
          end

          test 'unarchives case successfully using PATCH verb' do
            count_unarchived  = doug.cases.where(archived: false).count
            count_archived    = doug.cases.where(archived: true).count

            post :update, params: { case_id: one.id, case: { archived: false } }
            assert_response :ok

            one.reload
            assert_equal one.archived, false

            assert_equal count_unarchived + 1,  doug.cases.where(archived: false).count
            assert_equal count_archived - 1,    doug.cases.where(archived: true).count
          end

          test 'unarchives case successfully using PUT verb' do
            count_unarchived  = doug.cases.where(archived: false).count
            count_archived    = doug.cases.where(archived: true).count

            post :update, params: { case_id: one.id, case: { archived: false } }
            assert_response :ok

            one.reload
            assert_equal one.archived, false

            assert_equal count_unarchived + 1,  doug.cases.where(archived: false).count
            assert_equal count_archived - 1,    doug.cases.where(archived: true).count
          end
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              patch :update, params: { case_id: one.id, case: { case_name: 'New Name' } }
              assert_response :ok
            end
          end
        end
      end

      describe 'Listing cases' do
        let(:first_case)          { cases(:one) }
        let(:second_case)         { cases(:two) }
        let(:archived)            { cases(:archived) }
        let(:shared)              { cases(:shared_with_team) }
        let(:shared_with_owner)   { cases(:shared_with_owner) }
        let(:not_shared)          { cases(:not_shared) }
        let(:not_marked)          { cases(:case_not_marked_if_archived) }

        test 'returns only shallow information about cases' do
          get :index

          body = response.parsed_body
          cases = body['all_cases']

          cases.each do |c|
            assert_nil c['tries']
            assert_nil c['last_score']['queries'] if c['last_score']
          end
        end

        test 'returns list of cases owned by user' do
          get :index

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_includes ids, first_case.id
          assert_includes ids, second_case.id
        end

        test 'only returns teams the user can access' do
          not_a_member = teams(:case_finder_owned_team)
          shared.teams << not_a_member
          shared.save!

          get :index
          body = response.parsed_body
          test_team_ids = body['all_cases'].find_all do |c|
            c['case_id'] == shared.id
          end

          test_team_ids = test_team_ids.flat_map do |c|
            c['teams'].map do |co|
              co['id']
            end
          end

          assert_not_includes test_team_ids, not_a_member.id
          assert_includes test_team_ids, teams(:shared).id
        end

        test 'returns list of cases shared with the user' do
          get :index

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_includes ids, shared.id
        end

        test 'returns list of cases shared with team owned by the user' do
          get :index

          assert_response :ok

          cases = response.parsed_body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_includes ids, shared_with_owner.id

          the_case = cases.select { |c| c['case_id'] == shared_with_owner.id }.first

          assert_not_nil the_case['teams']
          assert the_case['teams'].count.positive?
        end

        test 'does not return cases not shared with the user even if owner is in the same team' do
          get :index

          assert_response :ok

          cases = response.parsed_body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_not_includes ids, not_shared.id
        end

        test 'returns case even if it was not explicitly marked not archived' do
          get :index

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_includes ids, not_marked.id
        end

        test 'does not return archived cases by default' do
          get :index

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_not_includes ids, archived.id
        end

        test 'returns archived cases when specified' do
          get :index, params: { archived: true }

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          assert cases.length == doug.cases.where(archived: true).length
          assert_equal cases.first['case_name'], archived.case_name
          assert_equal cases.first['case_id'], archived.id
        end

        test 'archived flag works as a string' do
          get :index, params: { archived: 'true' }

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          assert cases.length == doug.cases.where(archived: true).length
          assert_equal cases.first['case_name'], archived.case_name
          assert_equal cases.first['case_id'], archived.id
        end

        test 'only returns owned archived cases' do
          shared.update archived: true

          get :index, params: { archived: true }

          assert_response :ok

          cases = response.parsed_body['all_cases']
          names = cases.map { |c| c['case_name'] }

          assert_not_includes names, shared.case_name
        end

        test 'returns list of cases ordered by last viewed date' do
          date        = DateTime.current
          date_param  = date.strftime('%F %T')
          metadata    = second_case.metadata.find_or_create_by user_id: doug.id
          metadata.update last_viewed_at: date_param

          get :index

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_equal ids.first, second_case.id
        end

        test 'returns list of cases ordered by last viewed date works for shared cases' do
          date        = DateTime.current
          date_param  = date.strftime('%F %T')
          metadata    = shared.metadata.find_or_create_by user_id: doug.id
          metadata.update last_viewed_at: date_param

          get :index

          assert_response :ok

          body  = response.parsed_body
          cases = body['all_cases']

          ids = cases.map { |c| c['case_id'] }

          assert_equal ids.first, shared.id
        end
      end

      describe 'Default scorer' do
        let(:one)     { cases(:one) }
        let(:scorer)  { scorers(:valid) }

        test 'sets a default scorer successfully' do
          put :update, params: { case_id: one.id, case: { scorer_id: scorer.id } }

          assert_response :ok

          one.reload
          assert_equal one.scorer_id, scorer.id
        end

        test 'removes default scorer --> actually, set to system default' do
          one.scorer = scorer
          one.save!

          put :update, params: { case_id: one.id, case: { scorer_id: 0 } }

          assert_response :ok

          one.reload
          assert_equal one.scorer, Scorer.system_default_scorer
          assert_equal one.scorer.name, Rails.application.config.quepid_default_scorer
        end

        test 'removes default scorer if id is set to 0 --> actually, set to system default' do
          one.scorer = scorer
          one.save!

          put :update, params: { case_id: one.id, case: { scorer_id: 0 } }

          assert_response :ok

          one.reload
          assert_equal one.scorer.name, Rails.application.config.quepid_default_scorer
          # assert_nil one.scorer_id
          # assert_nil one.scorer
        end

        test 'returns an error if scorer does not exist' do
          one.scorer = scorer
          one.save!
          put :update, params: { case_id: one.id, case: { scorer_id: 'foo' } }

          assert_response :bad_request

          assert_equal response.parsed_body['scorer_id'], [ 'is not valid' ]

          one.reload
          assert_equal one.scorer, scorer
        end
      end
    end
  end
end
