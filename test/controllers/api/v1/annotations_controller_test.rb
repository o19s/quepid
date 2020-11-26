# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class AnnotationsControllerTest < ActionController::TestCase
      let(:user)        { users(:random) }
      let(:acase)       { cases(:score_case) }
      let(:first_try)   { tries(:first_try_for_score_case) }
      let(:second_try)  { tries(:second_try_for_score_case) }

      before do
        @controller = Api::V1::AnnotationsController.new

        login_user user
      end

      describe '#create' do
        test 'return an error if try id is not specified' do
          post :create, params: { case_id: acase.id, score: { score: 1 } }

          assert_response :bad_request
        end

        test 'creates a new score ' do
          data = {
            score:      {
              score:     (1..100).to_a.sample,
              all_rated: [ true, false ].sample,
              try_id:    first_try.id,
            },
            annotation: {
              message: 'message',
            },
          }

          assert_difference 'acase.scores.count' do
            post :create, params: data.merge(case_id: acase.id)

            assert_response :ok

            assert_equal data[:score][:score], json_response['score']['score']
          end
        end

        test 'creates a new score even the case has an existing one' do
          old_date = DateTime.current - 2.days
          acase.scores.create(created_at: old_date, user_id: user.id, try_id: first_try.id, score: 80)

          data = {
            score:      {
              score:     (1..100).to_a.sample,
              all_rated: [ true, false ].sample,
              try_id:    first_try.id,
            },
            annotation: {
              message: 'message',
            },
          }

          assert_difference 'acase.scores.count' do
            post :create, params: data.merge(case_id: acase.id)

            assert_response :ok
          end
        end

        test 'creates a new annotation' do
          data = {
            score:      {
              score:     (1..100).to_a.sample,
              all_rated: [ true, false ].sample,
              try_id:    first_try.id,
            },
            annotation: {
              message: 'message',
            },
          }

          assert_difference 'Annotation.count' do
            post :create, params: data.merge(case_id: acase.id)

            assert_response :ok

            assert_equal user.id,   json_response['user_id']
            assert_equal 'message', json_response['message']

            assert_not_nil json_response['score']
          end
        end
      end

      describe '#update' do
        let(:annotation)  { annotations(:one) }
        let(:acase)       { annotation.case }

        test 'return an error if the annotation id is incorrect' do
          data = { message: 'new message' }

          put :update, params: { case_id: acase.id, id: 'foo', annotation: data }

          assert_response :not_found
        end

        test 'updates annotation message' do
          data = { message: 'new message' }

          put :update, params: { case_id: acase.id, id: annotation.id, annotation: data }

          assert_response :ok

          annotation.reload
          assert_equal 'new message', annotation.message
        end
      end

      describe '#destroy' do
        let(:annotation)  { annotations(:one) }
        let(:acase)       { annotation.case }

        test 'return an error if the annotation id is incorrect' do
          delete :destroy, params: { case_id: acase.id, id: 'foo' }

          assert_response :not_found
        end

        test 'deletes annotation' do
          assert_difference 'Annotation.count', -1 do
            delete :destroy, params: { case_id: acase.id, id: annotation.id }

            assert_response :no_content
          end
        end

        test 'deletes score' do
          assert_difference 'Score.count', -1 do
            delete :destroy, params: { case_id: acase.id, id: annotation.id }

            assert_response :no_content
          end
        end
      end

      describe '#index' do
        let(:annotation)  { annotations(:one) }
        let(:acase)       { annotation.case }

        test 'returns list of annotations for case' do
          get :index, params: { case_id: acase.id }

          assert_response :ok

          assert_equal 1, json_response['annotations'].count

          ids = json_response['annotations'].map { |each| each['id'] }
          assert_includes ids, annotation.id

          the_annotation = json_response['annotations'].first

          assert_equal annotation.score.score,  the_annotation['score']['score']
          assert_equal annotation.score.try_id, the_annotation['score']['try_id']
          assert_equal annotation.message,      the_annotation['message']
        end
      end
    end
  end
end
