# frozen_string_literal: true

# A frozen, uniform random sample of the pairs one judge (the reference) has
# rated on a book, with the reference's rating on each as it was when drawn
# (docs/todo/judge_calibration.md C2). Every calibration run of the sample
# compares a judge with those ratings, so runs on one sample compare like
# with like.
class CalibrationSample < ApplicationRecord
  # Below MIN_SIZE pairs the result shows no agreement figure at all
  # (JudgeAgreement::MIN_PAIRS); MAX_SIZE bounds the LLM calls one run makes.
  MIN_SIZE = JudgeAgreement::MIN_PAIRS
  MAX_SIZE = 500
  DEFAULT_SIZE = 50

  belongs_to :book
  belongs_to :reference, class_name: 'User'
  belongs_to :created_by, class_name: 'User', optional: true

  has_many :sample_pairs, class_name: 'CalibrationSamplePair', inverse_of: :sample, dependent: :delete_all
  has_many :runs, class_name: 'CalibrationRun', inverse_of: :sample, dependent: :destroy

  # Draws size pairs uniformly at random -- no position weighting, no "fewest
  # judgements first" -- from the reference's eligible judgements, or all of
  # them when there are fewer.
  def self.draw! book:, reference:, size:, created_by: nil
    picked = book.calibration_eligible_judgements
      .where(user_id: reference.id)
      .order(Arel.sql(AdapterFunctions.random_function))
      .limit(size)
      .pluck(:query_doc_pair_id, :rating)

    transaction do
      sample = create!(book: book, reference: reference, created_by: created_by)
      rows = picked.map do |pair_id, rating|
        { calibration_sample_id: sample.id, query_doc_pair_id: pair_id, reference_rating: rating }
      end
      CalibrationSamplePair.insert_all!(rows) if rows.any?
      sample.update!(pairs_count: rows.size)
      sample
    end
  end

  def size
    pairs_count
  end

  # Pairs whose reference rating today is not the one drawn: changed, made
  # unrateable, or deleted. The result still uses the drawn ratings.
  def reference_changes_count
    current = book.calibration_eligible_judgements.where(user_id: reference_id)
      .where(query_doc_pair_id: sample_pairs.select(:query_doc_pair_id))
      .pluck(:query_doc_pair_id, :rating).to_h
    sample_pairs.count { |pair| current[pair.query_doc_pair_id] != pair.reference_rating }
  end
end
