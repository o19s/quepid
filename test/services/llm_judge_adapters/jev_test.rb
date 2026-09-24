# frozen_string_literal: true

require 'test_helper'

module LlmJudgeAdapters
  class JevTest < ActiveSupport::TestCase
    let(:judge) { users(:judge_judy) }
    let(:book) { books(:james_bond_movies) } # scale 0,1 labelled Not Relevant / Relevant
    let(:query_doc_pair) { query_doc_pairs(:starwars_qdp1) }
    let(:judgement) { Judgement.new(query_doc_pair: query_doc_pair, user: judge) }
    let(:adapter) { Jev.new('ts-key', { llm_provider: 'typesafe_jev', llm_model: 'jev-latest' }) }

    def envelope system_prompt: 'Judge relevance.', book: nil
      adapter.request_envelope(query_doc_pair, system_prompt: system_prompt, book: book)
    end

    def score_answer score:, confidence: 0.9, probabilities: { '0' => 0.1, '1' => 0.9 }
      {
        'model'   => 'jev-1.13.0',
        'answers' => {
          'relevance' => {
            'type'          => 'score', 'score' => score, 'confidence' => confidence,
            'probabilities' => probabilities,
            'legend'        => { '0' => 'Not Relevant', '1' => 'Relevant' }
          },
        },
      }
    end

    describe 'the request' do
      test 'asks one score question against the book scale, at the systemone endpoint' do
        result = envelope(book: book)

        assert_equal 'v1/systemone', result[:path]
        assert_equal({ 'Authorization' => 'Bearer ts-key' }, result[:headers])
        assert_equal 'jev-latest', result[:body][:model]

        question = result[:body][:questions]['relevance']

        assert_equal 'score', question[:type]
        assert_equal [ 'Not Relevant', 'Relevant' ], question[:criteria]
        assert_equal 'Judge relevance.', question[:instructions]
      end

      test 'sends the pair as a text state object, never as a chat prompt' do
        state = envelope(book: book)[:body][:state]

        assert_equal query_doc_pair.query_text, state[:query]
        assert_equal query_doc_pair.document_fields.keys.sort, state[:document].keys.sort
        assert_not state.to_json.include?('image_url'), 'Jev takes text only; no chat image block'
      end

      test 'appends the book scoring guidelines to the instructions when it has them' do
        book.update!(scoring_guidelines: 'Prefer exact title matches.')

        assert_includes envelope(book: book)[:body][:questions]['relevance'][:instructions],
                        'Prefer exact title matches.'
      end

      test 'a scale longer than ten levels is asked as a choice between the rating values' do
        long_scale = Book.new(name: 'Long', scale: (0..12).to_a)
        question = envelope(book: long_scale)[:body][:questions]['relevance']

        assert_equal 'choice', question[:type]
        assert_equal 13, question[:criteria].size
        assert_equal "Rating 7 on this book's scale", question[:criteria]['7']
      end

      test 'a book with no scale is refused, because there is nothing to rate against' do
        error = assert_raises(RuntimeError) { envelope(book: Book.new(name: 'Scaleless', scale: [])) }

        assert_match(/no scale configured/, error.message)
      end

      test 'a request with no book at all says so plainly, rather than blaming the scale' do
        from_prompts = assert_raises(RuntimeError) { adapter.envelope([], 'Judge relevance.') }
        from_pair = assert_raises(RuntimeError) { envelope(book: nil) }

        assert_match(/needs a book/, from_prompts.message)
        assert_match(/needs a book/, from_pair.message)
        assert_no_match(/no scale configured/, from_pair.message)
      end

      test 'an oversized document field is capped rather than left to 422' do
        query_doc_pair.document_fields = { 'body' => 'x' * 9_000 }
        state = envelope(book: book)[:body][:state]

        assert_operator state[:document]['body'].length, :<=, Jev::MAX_FIELD_CHARS + 20
        assert_includes state[:document]['body'], Jev::TRUNCATION_MARKER.strip
      end

      test 'the envelope is still inert data that survives JSON' do
        result = envelope(book: book)

        assert_equal result.deep_stringify_keys, JSON.parse(result.to_json)
      end
    end

    describe 'reading the answer' do
      test 'snaps the score onto one of the book own rating values' do
        adapter.apply_response(judgement, score_answer(score: 0.8), book: book)

        assert_in_delta(1.0, judgement.rating)
      end

      test 'rounds down below the midpoint as well' do
        adapter.apply_response(judgement, score_answer(score: 0.4), book: book)

        assert_in_delta(0.0, judgement.rating)
      end

      test 'a scale that does not start at zero maps by level, not by value' do
        four_point = Book.new(name: 'Four', scale: [ 1, 2, 3, 4 ])
        answer = score_answer(score: 0.0, probabilities: { '0' => 1.0 })

        adapter.apply_response(judgement, answer, book: four_point)

        assert_in_delta(1.0, judgement.rating)
      end

      test 'writes an explanation out of the numbers, since Jev writes no prose' do
        answer = score_answer(score: 0.57, confidence: 0.35, probabilities: { '0' => 0.43, '1' => 0.57 })

        adapter.apply_response(judgement, answer, book: book)

        assert_equal 'Jev rated 1 ("Relevant") -- raw score 0.57 of 0-1, confidence 0.35. ' \
                     'Distribution: 0: 43%, 1: 57%. (model jev-1.13.0)',
                     judgement.explanation
      end

      test 'a choice answer is the rating itself' do
        answer = {
          'model'   => 'jev-1.13.0',
          'answers' => { 'relevance' => { 'type'          => 'choice', 'choice' => '7', 'confidence' => 0.8,
                                          'probabilities' => { '7' => 0.8, '2' => 0.2 } } },
        }

        adapter.apply_response(judgement, answer, book: Book.new(name: 'Long', scale: (0..12).to_a))

        assert_in_delta(7.0, judgement.rating)
        assert_includes judgement.explanation, 'Jev rated 7'
      end

      test 'a missing answer is an error the caller can turn into an unrateable judgement' do
        assert_raises(RuntimeError) { adapter.apply_response(judgement, { 'answers' => {} }, book: book) }
      end

      test 'applying a response saves nothing' do
        adapter.apply_response(judgement, score_answer(score: 1.0), book: book)

        assert_predicate judgement, :new_record?
      end
    end

    describe 'the confidence floor' do
      let(:picky) { Jev.new('ts-key', { llm_provider: 'typesafe_jev', jev_min_confidence: 0.5 }) }

      test 'a spread out answer is treated as no answer, with the numbers kept for review' do
        answer = score_answer(score: 0.5, confidence: 0.2, probabilities: { '0' => 0.5, '1' => 0.5 })

        picky.apply_response(judgement, answer, book: book)

        assert_predicate judgement, :unrateable
        assert_nil judgement.rating
        assert_includes judgement.explanation, 'confidence 0.2'
      end

      test 'a confident answer passes the floor' do
        picky.apply_response(judgement, score_answer(score: 1.0, confidence: 0.95), book: book)

        assert_in_delta(1.0, judgement.rating)
        assert_not judgement.unrateable
      end

      test 'with no floor configured every answer counts' do
        adapter.apply_response(judgement, score_answer(score: 1.0, confidence: 0.01), book: book)

        assert_in_delta(1.0, judgement.rating)
        assert_not judgement.unrateable
      end
    end
  end
end
