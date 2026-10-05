# frozen_string_literal: true

# One AI judge rating one calibration sample (docs/todo/judge_calibration.md
# C4, C5). CalibrationRunJob fills in the answers; #agreement compares them
# with the reference's ratings.
#
# judge_snapshot is the prompt and options the run judges with. It starts as
# the judge's own, and a tuning run can override the prompt or minimum
# confidence (#with_settings) to try them without changing the judge; the
# judge only changes if someone applies them (#apply_settings_to_judge!).
class CalibrationRun < ApplicationRecord
  STATUSES = %w[queued running done cancelled failed].freeze
  ACTIVE_STATUSES = %w[queued running].freeze

  belongs_to :sample, class_name: 'CalibrationSample', foreign_key: :calibration_sample_id, inverse_of: :runs
  belongs_to :judge, class_name: 'AiJudge'
  belongs_to :created_by, class_name: 'User', optional: true

  has_many :answers, class_name: 'CalibrationAnswer', inverse_of: :run, dependent: :delete_all

  validates :status, inclusion: { in: STATUSES }

  delegate :book, :reference, to: :sample

  scope :for_book, ->(book) { joins(:sample).where(calibration_samples: { book_id: book.id }) }

  # The settings a calibration can override to try them out.
  TUNABLE_OPTIONS = %w[jev_min_confidence].freeze

  def self.snapshot_of judge
    { 'system_prompt' => judge.system_prompt, 'judge_options' => judge.judge_options.deep_stringify_keys }
  end

  # A snapshot with the given prompt and tunable options in place of the
  # snapshot's own. Blank values clear an option (no minimum confidence).
  def self.with_settings snapshot, system_prompt: nil, options: {}
    tuned = snapshot.deep_dup
    tuned['system_prompt'] = system_prompt unless system_prompt.nil?
    options.slice(*TUNABLE_OPTIONS).each do |name, value|
      value.blank? ? tuned['judge_options'].delete(name) : tuned['judge_options'][name] = value.to_s
    end
    tuned
  end

  # Starts a run of judge on sample with snapshot's settings: the judge's
  # own, as it is now, unless given.
  def self.start! sample:, judge:, created_by:, snapshot: snapshot_of(judge)
    run = create!(sample: sample, judge: judge, created_by: created_by, judge_snapshot: snapshot)
    CalibrationRunJob.perform_later(run)
    run
  end

  # The judge as this run judges: its saved record with the run's prompt and
  # options in memory. Never saved.
  def tuned_judge
    judge.dup.tap do |copy|
      copy.id = judge.id
      copy.system_prompt = judge_snapshot['system_prompt']
      copy.judge_options = judge_snapshot['judge_options']
    end
  end

  # Makes this run's settings the judge's own.
  def apply_settings_to_judge!
    judge.update!(system_prompt: judge_snapshot['system_prompt'], judge_options: judge_snapshot['judge_options'])
  end

  STATUSES.each do |name|
    define_method(:"#{name}?") { status == name }
  end

  def active?
    ACTIVE_STATUSES.include?(status)
  end

  def broadcast_channel
    book.calibrations_broadcast_channel
  end

  # The sample's pairs this run hasn't answered yet.
  def pending_pairs
    QueryDocPair.where(id: sample.sample_pairs.select(:query_doc_pair_id))
      .where.not(id: answers.select(:query_doc_pair_id))
  end

  def answered_count
    answers_count
  end

  # Unrateable answers have no grade to compare, so they are counted, not compared.
  def agreement
    @agreement ||= begin
      reference_ratings = sample.sample_pairs.to_h { |pair| [ pair.query_doc_pair_id, pair.reference_rating ] }
      ratings = answers.rateable.map { |answer| [ reference_ratings[answer.query_doc_pair_id], answer.rating ] }
      JudgeAgreement.new(ratings, scale: JudgeScale.for(book).values)
    end
  end

  # The rateable answers in one cell of the confusion matrix.
  def answers_in_cell reference_grade, judge_grade
    reference_ratings = sample.sample_pairs.to_h { |pair| [ pair.query_doc_pair_id, pair.reference_rating ] }
    answers.rateable.includes(:query_doc_pair).order(:id).select do |answer|
      same_grade?(reference_ratings[answer.query_doc_pair_id], reference_grade) && same_grade?(answer.rating, judge_grade)
    end
  end

  def unrateable_count
    answers.where(unrateable: true).count
  end

  # True when the judge's saved prompt or options differ from what this run
  # used: the judge was edited since, or this run tried other settings.
  def stale?
    judge_snapshot.present? && judge_snapshot != self.class.snapshot_of(judge)
  end

  # How this run's settings differ from the judge's saved ones, in words.
  def changes_since_judge
    compare_snapshots(judge_snapshot || {}, self.class.snapshot_of(judge))
  end

  # What changed in the judge between another run and this one, in words:
  # ["prompt", "model"]. Empty when nothing did.
  def changes_since other
    compare_snapshots(judge_snapshot || {}, other.judge_snapshot || {})
  end

  private

  def compare_snapshots mine, theirs
    changes = []
    changes << 'prompt' if mine['system_prompt'] != theirs['system_prompt']
    options = mine['judge_options'] || {}
    other_options = theirs['judge_options'] || {}
    changes << 'provider' if options['llm_provider'] != other_options['llm_provider']
    changes << 'model' if options['llm_model'] != other_options['llm_model']
    changes << 'minimum confidence' if options['jev_min_confidence'] != other_options['jev_min_confidence']
    rest = ->(opts) { opts.except('llm_provider', 'llm_model', 'jev_min_confidence') }
    changes << 'other settings' if rest.call(options) != rest.call(other_options)
    changes
  end

  # Grades are scale values (0, 1, 2.5), so this is exact in practice.
  def same_grade? rating, grade
    !rating.nil? && (rating.to_f - grade.to_f).abs < Float::EPSILON
  end
end
