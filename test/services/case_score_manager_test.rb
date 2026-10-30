# frozen_string_literal: true

require 'test_helper'

class CaseScoreManagerTest < ActiveSupport::TestCase
  cover 'CaseScoreManager*'

  let(:service) { CaseScoreManager.new the_case }
  let(:the_try) { the_case.tries.latest }
  let(:user)    { users(:random) }

  let(:score_data) do
    {
      all_rated:  true,
      queries:    {},
      score:      42,
      try_number: the_try.try_number,
      user_id:    user.id,
    }
  end

  describe '#update' do
    describe 'when score data is invalid' do
      let(:the_case) { cases(:case_without_score) }

      test 'raises an error if creation fails' do
        score_data[:try_number] = 999_999

        assert_raises(ActiveRecord::RecordInvalid) do
          service.update score_data
        end
        assert_not_empty service.errors[:try_number]
      end

      test 'creates a score without a try when no try_number is given' do
        score_data.delete(:try_number)

        score = service.update score_data

        assert_predicate score, :persisted?
        assert_nil score.try_id
      end
    end

    describe 'when score data does not include any scores' do
      let(:the_case) { cases(:case_without_score) }

      test 'ignores the process if the score is 0 and the queries object is empty' do
        score_data[:score]    = 0
        score_data[:queries]  = {}

        assert_no_difference 'Score.count' do
          assert_no_difference 'the_case.updated_at' do
            service.update score_data
          end
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
          assert_changes 'the_case.updated_at' do
            travel 1.second # otherwise the updated_at doesn't change
            service.update score_data

            the_case.reload

            assert_not_nil the_case.last_score
            assert_equal 0, the_case.last_score.score
          end
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

      test 'accepts aggregate-only scores after query scores and ignores an identical repeat' do
        the_case.scores.update_all user_id: user.id, try_id: the_try.id, scorer_id: the_case.scorer.id,
                                   score: 0.42, queries: { '174' => { score: 1, text: 'canine' } },
                                   updated_at: 6.minutes.ago
        score_data.delete(:queries)
        score_data[:scorer_id] = the_case.scorer.id
        score_data[:score] = 0.42

        saved = nil
        assert_difference 'the_case.scores.count', 1 do
          saved = service.update score_data
        end
        assert_nil saved.queries
        assert_in_delta 0.42, saved.score

        assert_no_difference 'the_case.scores.count' do
          assert_equal saved.id, service.update(score_data).id
        end
      end

      test 'preserves distinct fractional scores outside the rating update window' do
        the_case.scores.update_all user_id: user.id, try_id: the_try.id, scorer_id: the_case.scorer.id,
                                   score: 0.42, queries: {}, updated_at: 6.minutes.ago
        score_data[:scorer_id] = the_case.scorer.id
        score_data[:score] = 0.73

        assert_difference 'the_case.scores.count', 1 do
          assert_in_delta 0.73, service.update(score_data).score
        end
      end

      test 'updates existing score if last score was last updated less than 5 min ago' do
        the_case.scores.update_all user_id: user.id, try_id: the_try.id, scorer_id: the_case.scorer.id,
                                   updated_at: 1.minute.ago
        score_data[:scorer_id] = the_case.scorer.id

        last_score = the_case.last_score

        assert_no_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.id, last_score.id
        end
      end

      test 'creates a new score when the last score points at a deleted try' do
        the_case.scores.update_all user_id: user.id, scorer_id: the_case.scorer.id, updated_at: 1.minute.ago
        the_case.scores.update_all try_id: 0
        score_data[:scorer_id] = the_case.scorer.id

        assert_difference 'the_case.scores.count' do
          service.update score_data
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

        score_data[:scorer_id] = the_case.scorer.id
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

    describe 'case with no queries, and only scores' do
      # we may want to get rid of the no queries means no score requirement
      let(:the_case) { cases(:case_no_queries) }

      let(:score_data) do
        {
          all_rated:  [ false ],
          queries:    {},
          score:      0.79,
          try_number: 1,
          user_id:    user.id,
        }
      end

      test 'creates a new score' do
        assert_empty the_case.scores
        assert_not_empty the_case.tries

        score_data[:scorer_id] = the_case.scorer.id

        assert_difference 'the_case.scores.count' do
          assert_changes 'the_case.updated_at' do
            travel 1.second
            service.update score_data

            the_case.reload

            assert_not_nil the_case.last_score
            assert_instance_of Score, the_case.last_score

            assert_in_delta(the_case.last_score.score, 0.79)
          end
        end

        the_case.reload
        last_score = the_case.last_score
        assert_no_difference 'the_case.scores.count' do
          service.update score_data

          the_case.reload

          assert_not_nil the_case.last_score
          assert_equal the_case.last_score.id, last_score.id
        end

        # Run quick enough that we update the existing score
        score_data[:score] = 0.99
        assert_no_difference 'the_case.scores.count' do
          assert_changes 'the_case.updated_at' do
            travel 1.second
            service.update score_data

            the_case.reload

            assert_not_nil the_case.last_score
            assert_in_delta(the_case.last_score.score, 0.99)
          end
        end

        # now wait long enough to create a new score
        the_case.scores.update_all updated_at: 2.days.ago
        score_data[:score] = 0.91
        assert_difference 'the_case.scores.count' do
          assert_changes 'the_case.updated_at' do
            travel 1.second
            service.update score_data

            the_case.reload

            assert_not_nil the_case.last_score
            assert_in_delta(the_case.last_score.score, 0.91)
          end
        end
      end
    end
  end

  # The dedupe decision: when does a re-posted score update/ignore the latest score, and when
  # does it start a new history row? Driven through #update with a frozen clock.
  describe 'score history decisions' do
    let(:the_case) { cases(:case_with_score) }
    let(:now) { Time.zone.local(2026, 1, 15, 12, 0, 0) }
    let(:queries_a) { { '174' => { 'score' => 1, 'text' => 'canine' } } }

    before { travel_to(now) }

    def seed_last_score updated_at:, score: 0.42, queries: {}
      the_case.scores.update_all user_id: user.id, try_id: the_try.id, scorer_id: the_case.scorer.id,
                                 score: score, queries: queries, updated_at: updated_at
      the_case.reload.last_score
    end

    def post attributes = {}
      data = { all_rated: true, queries: {}, score: 0.42, try_number: the_try.try_number,
               user_id: user.id, scorer_id: the_case.scorer.id }.merge(attributes)
      service.update(data)
    end

    # Between the 5 minute and 1 day windows only the query comparison decides.
    {
      'both blank'                      => [ {}, {}, false ],
      'last blank, new queries present' => [ {}, { '174' => { 'score' => 1, 'text' => 'canine' } }, false ],
      'last present, new blank'         => [ { '174' => { 'score' => 1, 'text' => 'canine' } }, {}, true ],
      'identical'                       => [ { '174' => { 'score' => 1, 'text' => 'canine' } },
                                             { '174' => { 'score' => 1, 'text' => 'canine' } }, false ],
      'a query score changed'           => [ { '174' => { 'score' => 1, 'text' => 'canine' } },
                                             { '174' => { 'score' => 0, 'text' => 'canine' } }, true ],
      'a query was added'               => [ { '174' => { 'score' => 1, 'text' => 'canine' } },
                                             { '174' => { 'score' => 1, 'text' => 'canine' },
                                               '175' => { 'score' => 1, 'text' => 'feline' } }, true ],
      'a query was removed'             => [ { '174' => { 'score' => 1, 'text' => 'canine' },
                                               '175' => { 'score' => 1, 'text' => 'feline' } },
                                             { '174' => { 'score' => 1, 'text' => 'canine' } }, true ],
    }.each do |name, (last_queries, new_queries, new_row)|
      test "a repeat score with queries #{name} #{new_row ? 'starts a new row' : 'is ignored'}" do
        last = seed_last_score(updated_at: 6.minutes.ago, queries: last_queries)

        result = nil
        assert_difference 'the_case.scores.count', new_row ? 1 : 0 do
          result = post(queries: new_queries.deep_symbolize_keys)
        end

        assert_equal !new_row, result.id == last.id
      end
    end

    test 'queries compare equal regardless of string or symbol keys' do
      last = seed_last_score(updated_at: 6.minutes.ago, queries: queries_a)

      assert_no_difference 'the_case.scores.count' do
        assert_equal last.id, post(queries: { '174': { score: 1, text: 'canine' } }).id
        assert_equal last.id, post(queries: { 174 => { 'score' => 1, 'text' => 'canine' } }).id
      end
    end

    test 'a different score within five minutes updates the latest row in place' do
      last = seed_last_score(updated_at: 1.minute.ago, queries: queries_a)

      assert_no_difference 'the_case.scores.count' do
        result = post(score: 0.9, all_rated: false, queries: { '999': { score: 0, text: 'new' } })

        assert_equal last.id, result.id
        assert_in_delta 0.9, result.reload.score
        assert_not result.all_rated
        assert_equal({ '999' => { 'score' => 0, 'text' => 'new' } }, result.queries)
      end
    end

    test 'the five minute window includes exactly five minutes' do
      last = seed_last_score(updated_at: 5.minutes.ago, queries: queries_a)

      assert_no_difference 'the_case.scores.count' do
        assert_equal last.id, post(score: 0.9, queries: queries_a.deep_symbolize_keys).id
      end
      assert_in_delta 0.9, last.reload.score
    end

    test 'a different score past five minutes starts a new row and leaves the old one' do
      last = seed_last_score(updated_at: 5.minutes.ago - 1.second, queries: queries_a)

      assert_difference 'the_case.scores.count', 1 do
        assert_not_equal last.id, post(score: 0.9, queries: queries_a.deep_symbolize_keys).id
      end
      assert_in_delta 0.42, last.reload.score
    end

    test 'an identical score is ignored up to exactly one day and starts a new row after' do
      last = seed_last_score(updated_at: 1.day.ago, queries: queries_a)
      assert_no_difference 'the_case.scores.count' do
        assert_equal last.id, post(queries: queries_a.deep_symbolize_keys).id
      end

      the_case.scores.update_all updated_at: 1.day.ago - 1.second
      assert_difference 'the_case.scores.count', 1 do
        post(queries: queries_a.deep_symbolize_keys)
      end
    end

    test 'a string score equal to the stored score is treated as identical' do
      last = seed_last_score(updated_at: 6.minutes.ago, queries: queries_a)

      assert_no_difference 'the_case.scores.count' do
        assert_equal last.id, post(score: '0.42', queries: queries_a.deep_symbolize_keys).id
      end
    end

    test 'a different user never reuses the latest score' do
      seed_last_score(updated_at: 1.minute.ago, queries: queries_a)

      assert_difference 'the_case.scores.count', 1 do
        post(user_id: users(:doug).id, queries: queries_a.deep_symbolize_keys)
      end
    end

    test 'a different scorer never reuses the latest score' do
      seed_last_score(updated_at: 1.minute.ago, queries: queries_a)

      assert_difference 'the_case.scores.count', 1 do
        post(scorer_id: scorers(:communal_scorer).id, queries: queries_a.deep_symbolize_keys)
      end
    end

    test 'a different try never reuses the latest score' do
      seed_last_score(updated_at: 1.minute.ago, queries: queries_a)
      other_try = the_case.tries.create!(try_number: the_try.try_number + 1, query_params: 'q=other',
                                         search_endpoint: the_try.search_endpoint)

      assert_difference 'the_case.scores.count', 1 do
        assert_equal other_try.id, post(try_number: other_try.try_number, queries: queries_a.deep_symbolize_keys).try_id
      end
    end

    test 'a repeat score within five minutes but with different queries starts a new row' do
      last = seed_last_score(updated_at: 1.minute.ago, queries: queries_a)

      assert_difference 'the_case.scores.count', 1 do
        result = post(queries: { '174': { score: 0, text: 'canine' } })

        assert_not_equal last.id, result.id
      end
      assert_equal queries_a, last.reload.queries
    end

    test 'an in-place update replaces all_rated, queries and score together' do
      last = seed_last_score(updated_at: 1.minute.ago, queries: queries_a)
      last.update_columns(all_rated: false)

      post(score: 0.9, all_rated: true, queries: { '999': { score: 1, text: 'other' } })

      last.reload
      assert last.all_rated
      assert_in_delta 0.9, last.score
      assert_equal({ '999' => { 'score' => 1, 'text' => 'other' } }, last.queries)
    end

    test 'string keys and string ids from the API are normalized' do
      last = seed_last_score(updated_at: 1.minute.ago, queries: queries_a)
      data = { 'all_rated' => true, 'queries' => { '174' => { 'score' => 0, 'text' => 'canine' } }, 'score' => '0.9',
               'try_number' => the_try.try_number.to_s, 'user_id' => user.id.to_s,
               'scorer_id' => the_case.scorer.id.to_s }

      assert_no_difference 'the_case.scores.count' do
        assert_equal last.id, service.update(data).id
      end
      assert_in_delta 0.9, last.reload.score
      assert_equal 'canine', data[:queries][:'174'][:text], 'the caller\'s hash is symbolized in place'
    end

    test 'a nil try number records the score without a try' do
      seed_last_score(updated_at: 6.minutes.ago)

      score = post(try_number: nil, score: 0.9)

      assert_predicate score, :persisted?
      assert_nil score.try_id
    end

    test 'a missing score is ignored even when queries are present' do
      assert_nil post(score: nil, queries: queries_a.deep_symbolize_keys)
      assert_nil post(score: '', queries: queries_a.deep_symbolize_keys)
    end

    test 'an unknown try number reports the number and leaves no unsaved score behind' do
      seed_last_score(updated_at: 6.minutes.ago)

      error = assert_raises(ActiveRecord::RecordInvalid) { post(try_number: 999_999) }

      assert_equal [ '999999 was not found for this case' ], service.errors[:try_number]
      assert_equal 'Validation failed: Try number 999999 was not found for this case', error.message
      assert_not(the_case.scores.target.any?(&:new_record?))
    end

    test 'update returns nil, not a score, for empty scores' do
      assert_nil post(score: nil)
      assert_nil post(score: '')
      assert_nil post(score: 0, queries: {})
      assert_nil post(score: '0.0', queries: nil)
    end

    test 'a zero score with queries is recorded' do
      seed_last_score(updated_at: 6.minutes.ago)

      assert_difference 'the_case.scores.count', 1 do
        assert_predicate post(score: 0, queries: { '1': { score: 0, text: 'a' } }), :persisted?
      end
    end

    test 'a non-zero score without queries is recorded' do
      seed_last_score(updated_at: 6.minutes.ago)

      assert_difference 'the_case.scores.count', 1 do
        assert_predicate post(score: 0.5, queries: {}), :persisted?
      end
    end

    test 'a new score touches the case, an ignored one does not' do
      seed_last_score(updated_at: 6.minutes.ago, queries: queries_a)
      the_case.update_columns(updated_at: 1.hour.ago)

      post(queries: queries_a.deep_symbolize_keys)
      assert_in_delta 1.hour.ago, the_case.reload.updated_at, 1

      post(score: 0.9, queries: queries_a.deep_symbolize_keys)
      assert_in_delta now, the_case.reload.updated_at, 1
    end
  end
end
# rubocop:enable Rails/SkipsModelValidations
