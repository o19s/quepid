# frozen_string_literal: true

# A frozen, uniform random sample of the pairs one judge (the reference) has
# rated on a book, with the reference's rating on each as it was when drawn
# (docs/todo/judge_calibration.md C2). Every calibration run of the sample
# compares a judge with those ratings, so runs on one sample compare like
# with like.
#
# A sample is drawn by pair (any pairs the reference rated) or by query
# (whole top lists the reference rated in full). A query sample is still a set
# of pairs, so it shows pair agreement too, and also how per-query scores
# would move (CalibrationScoreImpact).
class CalibrationSample < ApplicationRecord
  UNITS = %w[pairs queries].freeze

  # Below MIN_SIZE pairs the result shows no agreement figure at all
  # (JudgeAgreement::MIN_PAIRS); MAX_SIZE bounds the LLM calls one run makes.
  MIN_SIZE = JudgeAgreement::MIN_PAIRS
  MAX_SIZE = 500
  DEFAULT_SIZE = 50

  # A query sample takes each query's top QUERY_DEPTH pairs. Fewer than
  # MIN_QUERIES queries say too little about score impact.
  QUERY_DEPTH = 10
  MIN_QUERIES = CalibrationScoreImpact::MIN_QUERIES
  MAX_QUERIES = MAX_SIZE / QUERY_DEPTH
  DEFAULT_QUERIES = 20

  belongs_to :book
  belongs_to :reference, class_name: 'User'
  belongs_to :created_by, class_name: 'User', optional: true

  has_many :sample_pairs, class_name: 'CalibrationSamplePair', inverse_of: :sample, dependent: :delete_all
  has_many :runs, class_name: 'CalibrationRun', inverse_of: :sample, dependent: :destroy

  validates :unit, inclusion: { in: UNITS }

  # Draws size pairs uniformly at random -- no position weighting, no "fewest
  # judgements first" -- from the reference's eligible judgements, or all of
  # them when there are fewer.
  def self.draw! book:, reference:, size:, created_by: nil
    picked = book.calibration_eligible_judgements
      .where(user_id: reference.id)
      .order(Arel.sql(AdapterFunctions.random_function))
      .limit(size)
      .pluck(:query_doc_pair_id, :rating)

    create_with_pairs!(book: book, reference: reference, created_by: created_by, unit: 'pairs', picked: picked)
  end

  # Draws count queries uniformly at random from those whose whole top list
  # the reference rated, with every pair of each.
  def self.draw_queries! book:, reference:, count:, created_by: nil
    queries = book.calibration_complete_queries(reference).values.sample(count)
    picked = book.calibration_eligible_judgements
      .where(user_id: reference.id, query_doc_pair_id: queries.flatten)
      .pluck(:query_doc_pair_id, :rating)
    create_with_pairs!(book: book, reference: reference, created_by: created_by, unit: 'queries', picked: picked)
  end

  def self.create_with_pairs! book:, reference:, created_by:, unit:, picked:
    transaction do
      sample = create!(book: book, reference: reference, created_by: created_by, unit: unit)
      rows = picked.map do |pair_id, rating|
        { calibration_sample_id: sample.id, query_doc_pair_id: pair_id, reference_rating: rating }
      end
      CalibrationSamplePair.insert_all!(rows) if rows.any?
      sample.update!(pairs_count: rows.size)
      sample
    end
  end
  private_class_method :create_with_pairs!

  def by_queries?
    'queries' == unit
  end

  def queries_count
    QueryDocPair.where(id: sample_pairs.select(:query_doc_pair_id)).distinct.count(:query_text)
  end

  # "20 queries (200 pairs)" or "50 pairs".
  def description
    pairs = "#{pairs_count} #{'pair'.pluralize(pairs_count)}"
    by_queries? ? "#{queries_count} #{'query'.pluralize(queries_count)} (#{pairs})" : pairs
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
