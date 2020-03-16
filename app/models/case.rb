# frozen_string_literal: true

# == Schema Information
#
# Table name: cases
#
#  id              :integer          not null, primary key
#  case_name       :string(191)
#  search_url      :string(500)
#  field_spec      :string(500)
#  last_try_number :integer
#  user_id         :integer
#  archived        :boolean
#  scorer_id       :integer
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  scorer_type     :string(255)
#

# rubocop:disable Metrics/ClassLength
class Case < ActiveRecord::Base
  # Associations
  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_cases'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :scorer,
             polymorphic: true

  belongs_to :user

  has_many   :tries,
             dependent: :destroy

  has_many   :metadata,
             dependent: :destroy

  has_many   :ratings,
             through: :queries

  # rubocop:disable Rails/InverseOf
  has_many   :queries,  -> { order(arranged_at: :asc) },
             autosave:  true,
             dependent: :delete_all
  # rubocop:enable Rails/InverseOf

  has_many   :scores,   -> { order(updated_at:  :desc) },
             dependent:  :destroy,
             inverse_of: :case

  has_many   :snapshots,
             dependent: :destroy

  has_many   :annotations,
             through: :scores

  has_many   :user_scorers,
             through:     :queries,
             source:      :scorer,
             source_type: 'Scorer'

  has_many   :default_scorers,
             through:     :queries,
             source:      :scorer,
             source_type: 'DefaultScorer'

  # Validations
  validates :case_name, presence: true
  validates_with DefaultScorerExistsValidator

  # Callbacks
  before_create :set_scorer
  after_create  :add_default_try, if: proc { |a| a.tries.empty? }

  # Scopes
  scope :not_archived,  -> { where('`cases`.`archived` = false OR `cases`.`archived` IS NULL') }
  scope :for_user,      ->(user) {
    where.any_of(
      teams:         {
        owner_id: user.id,
      },
      teams_members: {
        member_id: user.id,
      },
      cases:         {
        user_id: user.id,
      }
    )
  }

  # Constants
  DEFAULT_NAME = 'Movies Search'

  def initialize attributes = nil, options = {}
    super

    # TODO: Move this to be the default value in MySQL
    self.archived = false if archived.nil?
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/ParameterLists
  def clone_case original_case, user, try: nil, clone_queries: false, clone_ratings: false, preserve_history: false
    transaction do
      self.user = user

      if preserve_history
        original_case.tries.each do |a_try|
          clone_try(a_try, true)
        end
      elsif try
        clone_try(try, false)
      end

      self.last_try_number = tries.last.try_number

      if clone_queries
        original_case.queries.each do |query|
          clone_query query, clone_ratings
        end
      end

      save!
    end
  end
  # rubocop:enable Metrics/ParameterLists
  # rubocop:enable Metrics/MethodLength

  def mark_archived
    self.archived = true
  end

  def mark_archived!
    mark_archived
    save
  end

  def rearrange_queries
    Arrangement::List.sequence queries
  end

  def last_score
    scores.last_one
  end

  private

  def set_scorer
    return true if scorer_id.present?

    self.scorer = if user&.scorer
                    user.scorer
                  elsif user&.default_scorer
                    user.default_scorer
                  else
                    DefaultScorer.published.order(published_at: :desc).first
                  end
  end

  def add_default_try
    try_number  = (last_try_number || -1) + 1
    the_try     = tries.create(try_number: try_number)
    update last_try_number: the_try.try_number
  end

  # rubocop:disable Metrics/MethodLength
  def clone_try the_try, preserve_history
    new_try = Try.new(
      escape_query:  the_try.escape_query,
      field_spec:    the_try.field_spec,
      name:          the_try.name,
      query_params:  the_try.query_params,
      search_engine: the_try.search_engine,
      search_url:    the_try.search_url,
      try_number:    preserve_history ? the_try.try_number : 0
    )
    tries << new_try

    the_try.curator_variables.each do |a_curator_variable|
      new_curator_variable = CuratorVariable.new(
        name:  a_curator_variable.name,
        value: a_curator_variable.value
      )
      new_try.curator_variables << new_curator_variable
    end
  end
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/MethodLength
  def clone_query query, clone_ratings
    new_query = ::Query.new(
      arranged_next:  query.arranged_next,
      arranged_at:    query.arranged_at,
      deleted:        query.deleted,
      query_text:     query.query_text,
      notes:          query.notes,
      threshold:      query.threshold,
      threshold_enbl: query.threshold_enbl
    )

    if clone_ratings
      query.ratings.each do |rating|
        new_rating = Rating.new(
          doc_id: rating.doc_id,
          rating: rating.rating
        )
        new_query.ratings << new_rating
      end
    end

    queries << new_query
  end

  # rubocop:enable Metrics/MethodLength
end
# rubocop:enable Metrics/ClassLength
