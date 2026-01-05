# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class CaseScoresControllerTest < ActionController::TestCase
      let(:user)        { users(:random) }
      let(:acase)       { cases(:score_case) }
      let(:first_try)   { tries(:first_try_for_score_case) }
      let(:second_try)  { tries(:second_try_for_score_case) }

      before do
        @controller = Api::V1::CaseScoresController.new

        login_user user
      end

      describe 'Updates case score' do
        test 'return an error if try id is not specified' do
          put :update, params: { case_id: acase.id, case_score: { score: 1 } }

          assert_response :bad_request
        end

        test 'returns no content if the score is empty' do
          data = {
            score:      0,
            all_rated:  [ true, false ].sample,
            try_number: first_try.try_number,
          }

          put :update, params: { case_id: acase.id, case_score: data }

          assert_response :no_content
        end

        test 'creates a new score if the case does not already have one' do
          data = {
            score:      (1..100).to_a.sample,
            all_rated:  [ true, false ].sample,
            try_number: first_try.try_number,
          }

          put :update, params: { case_id: acase.id, case_score: data }

          assert_response :ok

          score = acase.scores.where(user_id: user.id, try_id: first_try.id).first

          assert_equal score.score,     data[:score]
          assert_equal score.all_rated, data[:all_rated]
        end

        test 'saves hash of query scores' do
          data = {
            score:      (1..100).to_a.sample,
            all_rated:  [ true, false ].sample,
            try_number: first_try.try_number,
            queries:    {
              '1' => {
                'text'  => 'first query',
                'score' => '1',
              },
              '2' => {
                'text'  => 'second query',
                'score' => '9',
              },
            },
          }

          put :update, params: { case_id: acase.id, case_score: data }

          assert_response :ok

          score = acase.scores.where(user_id: user.id, try_id: first_try.id).first
          assert_equal score.queries, data[:queries]
        end

        test 'updates existing score and does not create a new one if score is super recent' do
          old_score = acase.scores.create(user_id: user.id, try_id: first_try.id, score: 80, scorer_id: acase.scorer.id)

          data = {
            score:      (1..100).to_a.sample,
            all_rated:  [ true, false ].sample,
            try_number: first_try.try_number,
            scorer_id:  acase.scorer.id,
          }

          assert_no_difference 'acase.scores.count' do
            put :update, params: { case_id: acase.id, case_score: data }

            assert_response :ok

            score = acase.last_score

            assert_equal score.score,     data[:score]
            assert_equal score.all_rated, data[:all_rated]
            assert_equal score.id,        old_score.id

            assert_equal 1, acase.scores.where(user_id: user.id, try_id: first_try.id).count
          end
        end

        test 'creates new score if existing score is old' do
          old_date = 2.days.ago
          acase.scores.create(
            created_at: old_date,
            updated_at: old_date,
            user_id:    user.id,
            try_id:     first_try.id,
            score:      80
          )

          data = {
            score:      (1..100).to_a.sample,
            all_rated:  [ true, false ].sample,
            try_number: first_try.try_number,
          }

          assert_difference 'acase.scores.count' do
            put :update, params: { case_id: acase.id, case_score: data }

            assert_response :ok

            score = acase.scores.where(user_id: user.id, try_id: first_try.id).first

            assert_equal score.score,     data[:score]
            assert_equal score.all_rated, data[:all_rated]

            assert_equal 2, acase.scores.where(user_id: user.id, try_id: first_try.id).count
          end
        end
      end

      describe 'Fetches case scores' do
        test 'returns an empty array when case has not scores' do
          get :index, params: { case_id: acase.id }

          assert_response :ok

          scores = response.parsed_body['scores']

          assert_empty(scores)
        end

        test 'returns an array of all the case scores' do
          now = DateTime.current
          acase.scores.create(try_id: first_try.id,   user_id: user.id, created_at: now, score: 80,
                              scorer_id: acase.scorer.id)
          acase.scores.create(try_id: second_try.id,  user_id: user.id, created_at: now, score: 80,
                              scorer_id: acase.scorer.id)

          get :index, params: { case_id: acase.id }

          assert_response :ok

          scores = response.parsed_body['scores']

          assert_instance_of Array, scores
          assert_equal 2, scores.length
          assert_equal scores.length, acase.scores.length
        end
      end

      describe 'Fetches case last score' do
        before do
          now       = DateTime.current
          yesterday = DateTime.current - 1.day

          # we actually query over the updated_at field, not the created_at to find last score
          @last_score = acase.scores.create(
            try_id:     first_try.id,
            user_id:    user.id,
            created_at: now,
            updated_at: now,
            score:      80
          )

          acase.scores.create(
            try_id:     second_try.id,
            user_id:    user.id,
            created_at: yesterday,
            updated_at: yesterday,
            score:      80
          )
        end

        test 'returns the last created/updated score' do
          get :show, params: { case_id: acase.id }

          assert_response :ok

          score = response.parsed_body

          assert_equal score['score'],  @last_score.score
          assert_equal score['try_id'], @last_score.try_id
        end

        test 'returns JSON that includes queries score' do
          @last_score.queries = { foo: 'bar' }
          @last_score.save

          get :show, params: { case_id: acase.id }

          assert_response :ok

          assert_not assigns(:shallow)

          assert_equal @last_score.id, json_response['id']
          assert_not_nil response.parsed_body['queries']
          assert_equal @last_score.queries, json_response['queries']
        end
      end
    end
  end
end
