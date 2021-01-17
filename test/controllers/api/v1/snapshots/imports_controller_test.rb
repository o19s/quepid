# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Snapshots
      class ImportsControllerTest < ActionController::TestCase
        let(:user) { users(:random) }

        before do
          @controller = Api::V1::Snapshots::ImportsController.new

          login_user user
        end

        describe 'Imports snapshots for a case' do
          let(:acase) { cases(:snapshot_case) }

          test 'creates new snapshot and corresponding docs' do
            created_at = DateTime.now.in_time_zone
            data = {
              snapshots: [
                {
                  name:       'Snapshot 1',
                  created_at: created_at,
                  queries:    {
                    'dog' => {
                      docs: [
                        { id: 'doc1', explain: '1', position: 1 },
                        { id: 'doc2', explain: '2', position: 2 }
                      ],
                    },
                    'cat' => {
                      docs: [
                        { id: 'doc3', explain: '3', position: 2 },
                        { id: 'doc4', explain: '4', position: 1 }
                      ],
                    },
                  },
                }
              ],
            }

            post :create, params: data.merge(case_id: acase.id)

            assert_response :ok

            snapshots = JSON.parse(response.body)['snapshots']

            first_snapshot_response = snapshots.first
            first_snapshot_data     = data[:snapshots].first
            response_time           = DateTime.parse(first_snapshot_response['time']).in_time_zone.strftime('%F %T')

            assert_equal first_snapshot_response['name'], first_snapshot_data[:name]
            assert_equal response_time,                   created_at.strftime('%F %T')

            saved_snapshot  = Snapshot.where(id: first_snapshot_response['id']).first
            queries_data    = first_snapshot_data[:queries]

            assert_equal saved_snapshot.snapshot_queries.length, queries_data.length
          end

          test 'works with multiple snapshots' do
            created_at = DateTime.now.in_time_zone
            data = {
              snapshots: [
                {
                  name:       'Snapshot 1',
                  created_at: created_at,
                  queries:    {
                    'dog' => {
                      docs: [
                        { id: 'doc1', explain: '1', position: 1 },
                        { id: 'doc2', explain: '2', position: 2 }
                      ],
                    },
                    'cat' => {
                      docs: [
                        { id: 'doc3', explain: '3', position: 2 },
                        { id: 'doc4', explain: '4', position: 1 }
                      ],
                    },
                  },
                },
                {
                  name:       'Snapshot 2',
                  created_at: created_at,
                  queries:    {
                    'canine' => {
                      docs: [
                        { id: 'doc5', explain: '5', position: 1 },
                        { id: 'doc6', explain: '6', position: 2 }
                      ],
                    },
                  },
                }
              ],
            }

            post :create, params: data.merge(case_id: acase.id)

            assert_response :ok

            snapshots = JSON.parse(response.body)['snapshots']

            assert_equal snapshots.length, data[:snapshots].length

            first_snapshot_response = snapshots.first
            first_snapshot_data     = data[:snapshots].first
            response_time           = DateTime.parse(first_snapshot_response['time']).in_time_zone.strftime('%F %T')

            assert_equal first_snapshot_response['name'], first_snapshot_data[:name]
            assert_equal response_time,                   created_at.strftime('%F %T')

            saved_snapshot  = Snapshot.where(id: first_snapshot_response['id']).first
            queries_data    = first_snapshot_data[:queries]

            assert_equal saved_snapshot.snapshot_queries.length, queries_data.length

            second_snapshot_response = snapshots[1]
            second_snapshot_data     = data[:snapshots][1]
            response_time = DateTime.parse(second_snapshot_response['time']).in_time_zone.strftime('%F %T')

            assert_equal second_snapshot_response['name'],  second_snapshot_data[:name]
            assert_equal response_time,                     created_at.strftime('%F %T')

            saved_snapshot  = Snapshot.where(id: second_snapshot_response['id']).first
            queries_data    = second_snapshot_data[:queries]

            assert_equal saved_snapshot.snapshot_queries.length, queries_data.length
          end
        end
      end
    end
  end
end
