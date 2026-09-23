# frozen_string_literal: true

# == Schema Information
#
# Table name: books
#
#  id                          :bigint           not null, primary key
#  archived                    :boolean          default(FALSE), not null
#  export_job                  :string(255)
#  import_job                  :string(255)
#  name                        :string(255)
#  populate_job                :string(255)
#  rank_depth                  :integer
#  scale                       :string(255)
#  scale_with_labels           :text(65535)
#  scoring_guidelines          :text(65535)
#  show_rank                   :boolean          default(FALSE)
#  support_implicit_judgements :boolean
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  owner_id                    :integer
#
# Indexes
#
#  index_books_owner_id  (owner_id)
#

#
# Indexes
#

#  index_books_owner_id                  (owner_id)
#
# Foreign Keys
#
#  fk_rails_...  (selection_strategy_id => selection_strategies.id)
#
require 'scale_serializer'

class Book < ApplicationRecord
  # Default scoring guidelines templates
  FOUR_POINT_GUIDELINES = <<~MARKDOWN
    **0 - Poor:** *Terrible results!* Clearly not desired. These are negative examples.
    **1 - Fair:** *Not what I'm looking for, but I see why.* Has some right words but misses the point.
    **2 - Good:** *Worth my time!* Provides partial or survey-level information.
    **3 - Perfect:** *Exactly what I need!* Reserved for targeted, exact results.

    [Judgement Rating Best Practices](https://github.com/o19s/quepid/wiki/Judgement-Rating-Best-Practices)
  MARKDOWN

  TWO_POINT_GUIDELINES = <<~MARKDOWN
    **0 - Irrelevant:** Not helpful. These are not the droids I'm looking for.
    **1 - Relevant:** Addresses some aspect of my information need.

    [Judgement Rating Best Practices](https://github.com/o19s/quepid/wiki/Judgement-Rating-Best-Practices)
  MARKDOWN
  # Associations
  # rubocop:disable-next Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_books'

  belongs_to :owner,
             class_name: 'User', optional: true

  # belongs_to :ai_judge,
  #           class_name: 'User', optional: true
  #
  # has_many :users, dependent: :destroy
  # has_many :ai_judges, through: :ai_judges

  has_many :books_ai_judges, dependent: :destroy
  has_many :ai_judges, through: :books_ai_judges, source: :ai_judge

  has_many :query_doc_pairs, dependent: :delete_all, autosave: true

  has_many   :judgements,
             through: :query_doc_pairs

  # Deduplicating by id rather than SELECT DISTINCT over every user column: a
  # judge appears once per judgement, but `users` carries a json options
  # column, and comparing whole rows is both more work than the question needs
  # and something not every database can do.
  def judges
    User.where(id: judgements.reselect(:user_id).distinct)
  end

  has_many :cases, dependent: :nullify

  has_many :rated_query_doc_pairs, -> { has_judgements },
           class_name: 'QueryDocPair',
           dependent:  :destroy,
           inverse_of: :book

  has_many :metadata,
           class_name: 'BookMetadatum',
           dependent:  :destroy

  has_one_attached :import_file
  has_one_attached :export_file

  # Virtual attribute for form display - allows selecting a scorer to copy scale from
  attr_accessor :scorer_id

  # Transform scale from array to a string
  serialize :scale, coder: ScaleSerializer
  serialize :scale_with_labels, coder: JSON

  after_destroy :delete_attachments

  # Scopes
  include ForUserScope

  scope :active, -> { where(archived: false) }
  scope :archived, -> { where(archived: true) }

  def archive!
    update(archived: true)
  end

  def unarchive!
    update(archived: false)
  end

  # Custom validation to prevent scale changes but allow label changes
  validate :scale_cannot_be_changed_if_judgements_exist

  after_initialize do |book|
    book.scale = [] if book.scale.nil? || (book.scale.respond_to?(:empty?) && book.scale.empty?)
  end

  # Returns the appropriate default scoring guidelines based on the scale size
  def default_scoring_guidelines
    return TWO_POINT_GUIDELINES if 2 == scale&.length
    return FOUR_POINT_GUIDELINES if 4 == scale&.length

    # For other scales, return a generic template
    FOUR_POINT_GUIDELINES
  end

  # Returns the scoring guidelines, falling back to defaults if not set
  def effective_scoring_guidelines
    scoring_guidelines.presence || default_scoring_guidelines
  end

  def scale_list= value
    self.scale = value.split(',') if value.present?
  end

  def scale_list
    # rubocop:disable Style/SafeNavigation
    scale.join(',') unless scale.nil?
    # scale&.join(',')
    # rubocop:enable Style/SafeNavigation
  end

  scope :with_counts, -> {
                        select <<~SQL.squish
                          books.*,
                          (
                            SELECT COUNT(query_doc_pairs.id) FROM query_doc_pairs
                            WHERE book_id = books.id
                          ) AS query_doc_pairs_count
                        SQL
                      }

  def queries_count
    query_doc_pairs.select(:query_text).distinct.count
  end

  # Book-level cap on how deep (by QueryDocPair#position, 1-indexed, lower =
  # higher-ranked) judging and coverage metrics look. A nil depth means
  # unlimited - matches how position itself is nullable/unranked today.
  # Defaults to this book's own rank_depth, but callers (e.g. the bulk judging
  # screen) can pass an explicit depth to override it for one request without
  # duplicating this filter.
  def query_doc_pairs_within_rank_depth depth = rank_depth
    depth.present? ? query_doc_pairs.where(position: ..depth) : query_doc_pairs
  end

  # Per-judge activity stats (sparkline of daily counts, total count, last
  # judged timestamp) for the given user ids, in a constant number of queries
  # regardless of how many judges are asked for. Shared by the book overview
  # page, the per-judge overview page, and the live activity broadcast so
  # they can't drift out of sync with each other.
  def judge_activity_for user_ids, days: 7
    return {} if user_ids.blank?

    start_date = (days - 1).days.ago.to_date
    daily_counts = judgements
      .where(user_id: user_ids)
      .where(judgements: { updated_at: start_date.beginning_of_day.. })
      .group(:user_id, Arel.sql('DATE(judgements.updated_at)'))
      .count
    totals = judgements.where(user_id: user_ids).group(:user_id).count
    last_ats = judgements.where(user_id: user_ids).group(:user_id).maximum(:updated_at)

    user_ids.index_with do |uid|
      sparkline = (days - 1).downto(0).map do |days_ago|
        date = days_ago.days.ago.to_date
        { date: date.strftime('%a'), count: daily_counts[[ uid, date ]] || 0 }
      end
      { sparkline: sparkline, count: totals[uid] || 0, last_judged_at: last_ats[uid] }
    end
  end

  # The Turbo Streams channel the book overview page's Judge Activity table
  # subscribes to (books/show.html.erb) and every job that broadcasts a
  # judgement-related update re-renders into. Single source of truth so the
  # channel name can't drift between the view and its broadcasters.
  def judgements_broadcast_channel
    "book_#{id}_judgements"
  end

  # One row per judge for the book overview's Judge Activity table: every
  # human judge who has judged anything, plus every assigned AI judge (shown
  # even at zero judgements, since being assigned is itself worth showing).
  # Shared by the initial page render and the live broadcast (which
  # re-renders the whole table on every change) so a judge's row is never
  # missing just because it didn't exist yet when a viewer's page loaded.
  def judge_activity_rows
    judge_ids = (judgements.where.not(user_id: nil).distinct.pluck(:user_id) + ai_judges.pluck(:id)).uniq
    return [] if judge_ids.empty?

    actively_judging_ids = RunJudgeJudyJob.actively_judging_user_ids(self)
    judges_by_id = User.where(id: judge_ids).index_by(&:id)
    activity = judge_activity_for(judge_ids)
    auto_run_ids = books_ai_judges.auto_run.pluck(:user_id)

    rows = judge_ids.filter_map do |uid|
      judge = judges_by_id[uid]
      next unless judge

      stats = activity.fetch(uid, { sparkline: [], count: 0, last_judged_at: nil })
      { judge: judge, sparkline: stats[:sparkline], last_judged_at: stats[:last_judged_at],
        count: stats[:count], actively_judging: actively_judging_ids.include?(judge.id),
        auto_run: auto_run_ids.include?(judge.id) }
    end

    rows.sort_by { |row| row[:judge].fullname }
  end

  # Not proud of this method, but it's the only way I can get the dependent
  # objects of a Book to actually delete!
  # Otherwise our foreign key on judgements to query_doc_pairs gets violated with
  # a book.destroy method.
  def really_destroy
    Judgement.joins(:query_doc_pair)
      .where(query_doc_pairs: { book_id: id })
      .delete_all
    query_doc_pairs.delete_all
    destroy
  end

  private

  # Validates that scale values cannot be changed if judgements exist
  # but allows changing scale_with_labels for the same scale
  def scale_cannot_be_changed_if_judgements_exist
    return unless persisted? && scale_changed?

    # Allow scale changes if no judgements exist yet
    return if judgements.empty?

    # Check if the actual scale values have changed (not just the labels)
    old_scale = scale_was
    new_scale = scale

    # If the scale values themselves have changed, prevent it
    errors.add(:scale, "cannot be changed when judgements exist. Current judgements use scale #{old_scale.inspect}") if old_scale != new_scale
  end

  def delete_attachments
    import_file.purge_later
    export_file.purge_later
  end
end
