# frozen_string_literal: true

require 'test_helper'

class CalibrationSampleTest < ActiveSupport::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:reference) { users(:matt) }

  describe 'draw!' do
    it "takes size of the reference's eligible pairs, with its rating on each" do
      pairs = rate_pairs_for_calibration(book, reference)

      sample = CalibrationSample.draw!(book: book, reference: reference, size: 30)

      assert_equal 30, sample.size
      assert_empty(sample.sample_pairs.map(&:query_doc_pair_id) - pairs.map(&:id))
      sample.sample_pairs.each do |sample_pair|
        assert_equal Judgement.find_by(user: reference, query_doc_pair_id: sample_pair.query_doc_pair_id).rating,
                     sample_pair.reference_rating
      end
    end

    it 'takes them all when there are fewer than asked for' do
      rate_pairs_for_calibration(book, reference, count: 3)

      assert_equal 3, CalibrationSample.draw!(book: book, reference: reference, size: 30).size
    end

    it 'ignores the three-judgement cap' do
      pair = rate_pairs_for_calibration(book, reference, count: 1).first
      pair.judgements.create!(user: users(:doug), rating: 1)
      pair.judgements.create!(user: users(:random), rating: 1)

      assert_equal [ pair.id ], CalibrationSample.draw!(book: book, reference: reference, size: 30).sample_pairs.map(&:query_doc_pair_id)
    end
  end

  describe 'draw_queries!' do
    it 'takes whole top lists the reference rated in full, and nothing else' do
      lists = rate_queries_for_calibration(book, reference, queries: 12)
      holed = lists.last
      holed.first.judgements.find_by(user: reference).update!(unrateable: true)

      sample = CalibrationSample.draw_queries!(book: book, reference: reference, count: 50)

      assert_predicate sample, :by_queries?
      assert_equal 11, sample.queries_count
      assert_equal 110, sample.size
      assert_empty(sample.sample_pairs.map(&:query_doc_pair_id) & holed.map(&:id))
      assert_equal '11 queries (110 pairs)', sample.description
    end

    it 'takes only the top ten of a longer list' do
      rate_queries_for_calibration(book, reference, queries: 1, depth: 12)

      assert_equal 10, CalibrationSample.draw_queries!(book: book, reference: reference, count: 1).size
    end
  end

  describe 'reference_changes_count' do
    it 'counts sampled ratings the reference has since changed or removed' do
      rate_pairs_for_calibration(book, reference, count: 4)
      sample = CalibrationSample.draw!(book: book, reference: reference, size: 4)
      judgements = Judgement.where(user: reference, query_doc_pair_id: sample.sample_pairs.select(:query_doc_pair_id)).order(:id)

      judgements.first.update!(rating: 1 - judgements.first.rating)
      judgements.second.destroy!

      assert_equal 2, sample.reference_changes_count
    end
  end

  it 'goes when its book does' do
    rate_pairs_for_calibration(book, reference, count: 2)
    sample = CalibrationSample.draw!(book: book, reference: reference, size: 2)

    book.really_destroy

    assert_not CalibrationSample.exists?(sample.id)
    assert_not CalibrationSamplePair.exists?(calibration_sample_id: sample.id)
  end
end
