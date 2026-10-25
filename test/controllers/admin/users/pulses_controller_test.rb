# frozen_string_literal: true

require 'test_helper'

module Admin
  module Users
    class PulsesControllerTest < ActionDispatch::IntegrationTest
      let(:admin)  { users(:doug) }
      let(:target) { users(:random) }
      let(:at)     { Time.zone.local(2020, 6, 15, 12, 0, 0) }
      let(:range)  { { start: '2020-06-01', end: '2020-06-30' } }

      setup do
        Bullet.enable = false
        login_user_for_integration_test admin
      end

      def pulse data, user: target, **extra
        get admin_user_pulse_url(user_id: user.id), params: range.merge(data: data).merge(extra), as: :json
      end

      test 'requires an administrator' do
        login_user_for_integration_test users(:random_1)

        pulse 'scores'

        assert_response :unauthorized
      end

      test 'returns not found for a missing user' do
        get admin_user_pulse_url(user_id: 0), params: range.merge(data: 'scores'), as: :json

        assert_response :not_found
      end

      test 'metadata counts case views per timestamp for the user within the range' do
        kase = cases(:random_case)
        CaseMetadatum.create!(case: kase, user: target, last_viewed_at: at)
        CaseMetadatum.create!(case: cases(:random_case_1), user: target, last_viewed_at: at + 1.year)

        pulse 'metadata'

        assert_response :success
        assert_equal({ at.to_i => 1 }, response.parsed_body.transform_keys(&:to_i))
      end

      test 'scores counts the target user scores within the range' do
        kase = cases(:score_case)
        Score.create!(case: kase, try: kase.tries.first, user: target, score: 0.5, created_at: at, updated_at: at)
        Score.create!(case: kase, try: kase.tries.first, user: admin, score: 0.5, created_at: at, updated_at: at)

        pulse 'scores'

        assert_response :success
        assert_equal({ at.to_i => 1 }, response.parsed_body.transform_keys(&:to_i))
      end

      test 'cases-created counts cases owned by the target user' do
        kase = cases(:random_case)
        kase.update_columns(created_at: at, owner_id: target.id)

        pulse 'cases-created'

        assert_response :success
        assert_equal({ at.to_i => 1 }, response.parsed_body.transform_keys(&:to_i))
      end

      test 'queries-created counts queries on cases owned by the target user' do
        kase = cases(:queries_case)
        kase.update_columns(owner_id: target.id)
        kase.queries.update_all(created_at: at)

        pulse 'queries-created'

        assert_response :success
        assert_equal({ at.to_i => kase.queries.count }, response.parsed_body.transform_keys(&:to_i))
      end

      test 'books-created counts books the current admin is involved with' do
        book = Book.create!(name: 'Pulse Book', owner: admin, scale: '0,1')
        book.update_columns(created_at: at)

        pulse 'books-created'

        assert_response :success
        assert_equal 1, response.parsed_body.transform_keys(&:to_i)[at.to_i]
      end

      test 'judgements-created counts judgements made by the current admin' do
        qdp = query_doc_pairs(:one)
        judgement = Judgement.create!(query_doc_pair: qdp, user: admin, rating: 1)
        judgement.update_columns(created_at: at)

        pulse 'judgements-created'

        assert_response :success
        assert_equal 1, response.parsed_body.transform_keys(&:to_i)[at.to_i]
      end

      test 'an unknown data value returns an empty object' do
        pulse 'nonsense'

        assert_response :success
        assert_empty response.parsed_body
      end

      test 'a missing data value returns an empty object' do
        get admin_user_pulse_url(user_id: target.id), params: range, as: :json

        assert_response :success
        assert_empty response.parsed_body
      end
    end
  end
end
