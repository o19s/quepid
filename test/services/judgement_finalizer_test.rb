# frozen_string_literal: true

require 'test_helper'

class JudgementFinalizerTest < ActiveSupport::TestCase
  let(:book) { books(:james_bond_movies) } # scale 0,1
  let(:judge) { users(:judge_judy) }
  let(:query_doc_pair) { query_doc_pairs(:starwars_qdp1) }

  def judgement_with rating, explanation: 'Because.'
    Judgement.new(query_doc_pair: query_doc_pair, user: judge, rating: rating, explanation: explanation)
  end

  test 'a rating on the book scale is left exactly as the judge gave it' do
    judgement = judgement_with(1.0)

    JudgementFinalizer.call(judgement, book: book)

    assert_in_delta(1.0, judgement.rating)
    assert_equal 'Because.', judgement.explanation
    assert_not judgement.unrateable
  end

  test 'a missing rating is unrateable' do
    judgement = judgement_with(nil)

    JudgementFinalizer.call(judgement, book: book)

    assert_predicate judgement, :unrateable
    assert_nil judgement.rating
  end

  test 'a rating outside the scale is unrateable, with the raw value kept for review' do
    judgement = judgement_with(3.0)

    JudgementFinalizer.call(judgement, book: book)

    assert_predicate judgement, :unrateable
    assert_nil judgement.rating
    assert_equal "Because. [LLM returned rating 3.0, outside this book's scale [0, 1]]",
                 judgement.explanation
  end

  test 'the annotation still reads sensibly when the judge explained nothing' do
    judgement = judgement_with(3.0, explanation: nil)

    JudgementFinalizer.call(judgement, book: book)

    assert_equal "[LLM returned rating 3.0, outside this book's scale [0, 1]]", judgement.explanation
  end

  test 'with no book there is nothing to validate against and the rating stands' do
    judgement = judgement_with(7.0)

    JudgementFinalizer.call(judgement)

    assert_in_delta(7.0, judgement.rating)
    assert_not judgement.unrateable
  end

  test 'a book with no scale configured leaves the rating alone too' do
    scaleless = Book.new(name: 'No scale', scale: [])
    judgement = judgement_with(7.0)

    JudgementFinalizer.call(judgement, book: scaleless)

    assert_in_delta(7.0, judgement.rating)
    assert_not judgement.unrateable
  end

  test 'it decides, it does not save -- the caller owns persistence' do
    judgement = judgement_with(3.0)

    JudgementFinalizer.call(judgement, book: book)

    assert_predicate judgement, :new_record?
  end

  test 'it returns the judgement so callers can chain' do
    judgement = judgement_with(1.0)

    assert_same judgement, JudgementFinalizer.call(judgement, book: book)
  end
end
