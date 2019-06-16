# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Cases
      class DropdownControllerTest < ActionController::TestCase
        let(:user) { users(:dropdown_user) }

        before do
          @controller = Api::V1::Cases::DropdownController.new

          login_user user
        end

        describe '#index' do
          let(:first_case)  { cases(:dropdown_case_1) }
          let(:second_case) { cases(:dropdown_case_2) }
          let(:archived)    { cases(:dropdown_case_archived) }
          let(:shared)      { cases(:shared_with_team) }

          before do
            date        = DateTime.current

            metadata    = first_case.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date

            metadata = second_case.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date

            metadata = archived.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date

            metadata = shared.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date
          end

          test 'returns only shallow information about cases' do
            get :index

            body = JSON.parse(response.body)
            cases = body['allCases']
            cases.each do |c|
              assert_nil c['tries']
              assert_nil c['lastScore']['queries'] if c['lastScore']
            end
          end

          test 'returns list of cases owned by user' do
            get :index

            assert_response :ok

            body  = JSON.parse(response.body)
            cases = body['allCases']

            ids = cases.map { |c| c['caseNo'] }

            assert_includes ids, first_case.id
            assert_includes ids, second_case.id
          end

          test 'returns list of cases shared with the user' do
            get :index

            assert_response :ok

            body  = JSON.parse(response.body)
            cases = body['allCases']

            ids = cases.map { |c| c['caseNo'] }

            assert_includes ids, shared.id
          end

          test 'does not return archived cases' do
            get :index

            assert_response :ok

            body  = JSON.parse(response.body)
            cases = body['allCases']

            ids = cases.map { |c| c['caseNo'] }

            assert_not_includes ids, archived.id
          end

          test 'limits list to 3 cases' do
            get :index

            assert_response :ok

            body  = JSON.parse(response.body)
            cases = body['allCases']

            assert cases.length <= 3
          end

          test 'returns list of cases ordered by last viewed date' do
            date        = DateTime.current
            metadata    = second_case.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date

            metadata = first_case.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date - 30.minutes

            metadata = shared.metadata.find_or_create_by user_id: user.id
            metadata.update last_viewed_at: date - 30.minutes

            get :index

            assert_response :ok

            body  = JSON.parse(response.body)
            cases = body['allCases']

            ids = cases.map { |c| c['caseNo'] }

            assert_equal ids.first, second_case.id
          end

          test 'returns count of cases user has access to' do
            get :index

            assert_response :ok

            body  = JSON.parse(response.body)
            count = body['casesCount']

            assert_not_nil count
          end
        end
      end
    end
  end
end
