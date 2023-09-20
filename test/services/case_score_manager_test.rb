# frozen_string_literal: true

require 'test_helper'

# rubocop:disable Rails/SkipsModelValidations
class CaseScoreManagerTest < ActiveSupport::TestCase
  let(:service) { CaseScoreManager.new the_case }
  let(:the_try) { the_case.tries.latest }
  let(:user)    { users(:random) }

  let(:score_data) do
    {
      all_rated:  [ true, false ].sample,
      queries:    {},
      score:      (1..100).to_a.sample,
      try_number: the_try.try_number,
      user_id:    user.id,
    }
  end

  describe '#update' do
    describe 'when score data is invalid' do
      let(:the_case) { cases(:case_without_score) }

      test 'raises an error if creation fails' do
        score_data.delete(:user_id)

        assert_raises(ActiveRecord::RecordInvalid) do
          service.update score_data
        end
      end
    end

    describe 'when score data does not include any scores' do
      let(:the_case) { cases(:case_without_score) }

      test 'ignores the process if the score is 0 and the queries object is empty' do
        score_data[:score]    = 0
        score_data[:queries]  = {}

        assert_no_difference 'Score.count' do
          service.update score_data
        end
      end

      test 'ignores the process if the score is blank' do
        score_data[:score]    = nil
        score_data[:queries]  = {}

        assert_no_difference 'Score.count' do
          service.update score_data
        end
      end

      test 'does not ignore 0 score if queries object is not empty' do
        score_data[:score]    = 0
        score_data[:queries]  = {
          '174' => { score: 0, text: 'canine' },
        }

        assert_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.score, 0
        end
      end
    end

    describe 'case without an existing score' do
      let(:the_case) { cases(:case_without_score) }

      test 'creates a new score for case' do
        assert_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.score, score_data[:score]
        end
      end

      test 'gets the try from the try_number parameter' do
        assert_difference 'the_case.scores.count' do
          # remove the try_id and add the try_number
          score_data.except!(:try_id)
          score_data[:try_number] = the_try.try_number

          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.score, score_data[:score]
        end
      end
    end

    describe 'case with a score for one of the tries' do
      let(:the_case) { cases(:case_with_score_for_first_try) }

      test 'creates a new score for case and try' do
        assert_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.score,   score_data[:score]
          assert_equal the_case.last_score.try_id,  the_try.id
        end
      end
    end

    describe 'case and try with recent score' do
      let(:the_case) { cases(:case_with_score) }

      test 'updates existing score if last score was last updated less than 5 min ago' do
        the_case.scores.update_all user_id: user.id, try_id: the_try.id, updated_at: 1.minute.ago

        last_score = the_case.last_score

        assert_no_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.id, last_score.id
        end
      end

      test 'creates new score if last score was last updated more than 5 min ago' do
        the_case.scores.update_all updated_at: 6.minutes.ago
        last_score = the_case.last_score

        assert_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_not_equal the_case.last_score.id, last_score.id
        end
      end

      test 'updates existing score if same score and last score was last updated less than 1 day ago' do
        last_score = the_case.last_score
        score_data[:score] = last_score.score

        assert_equal the_case.last_score.score, score_data[:score]

        assert_no_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.id,    last_score.id
          assert_equal the_case.last_score.score, score_data[:score]
        end
      end

      test 'creates new score if same score and last score was last updated more than 1 day ago' do
        the_case.scores.update_all updated_at: 2.days.ago
        last_score = the_case.last_score
        score_data[:score] = last_score.score

        assert_equal the_case.last_score.score, score_data[:score]

        assert_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil   the_case.last_score
          assert_not_equal the_case.last_score.id, last_score.id
        end
      end

      test 'creates new score if a new query is added' do
        the_case.scores.update_all updated_at: 2.days.ago

        last_score                  = the_case.last_score
        score_data[:score]          = last_score.score
        score_data[:queries]        = last_score.queries || {}
        score_data[:queries]['777'] = { score: 0, text: 'feline' }

        assert_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil   the_case.last_score
          assert_not_equal the_case.last_score.id, last_score.id
        end
      end
    end
  end
end
# rubocop:enable Rails/SkipsModelValidations
