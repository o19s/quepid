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
#

# rubocop:disable Metrics/ClassLength
class Case < ApplicationRecord
  # Associations
  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_cases'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :scorer, optional: true

  belongs_to :user, optional: true

  has_many   :tries,     -> { order(try_number: :desc) },
             dependent:  :destroy,
             inverse_of: :case

  has_many   :metadata,
             dependent: :destroy

  # has_many   :ratings,  # wed ont' actually need htis.
  #           through: :queries

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

  has_many   :user_scorers, -> { where(communal: false) }, through: :queries, source: :scorer

  # Validations
  validates :case_name, presence: true
  validates_with ScorerExistsValidator

  # Callbacks
  after_initialize  :set_scorer
  after_create      :add_default_try

  after_initialize do |c|
    c.archived = false if c.archived.nil?
  end

  # Scopes
  scope :not_archived, -> { where('`cases`.`archived` = false OR `cases`.`archived` IS NULL') }

  scope :for_user, ->(user) {
    joins('
      LEFT OUTER JOIN `case_metadata` ON `case_metadata`.`case_id` = `cases`.`id`
      LEFT OUTER JOIN `teams_cases` ON `teams_cases`.`case_id` = `cases`.`id`
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_cases`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
    ').where('
        `teams`.`owner_id` = ? OR `teams_members`.`member_id` = ? OR `cases`.`user_id` = ?
    ', user.id, user.id, user.id)
  }

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

      self.last_try_number = tries.first.try_number
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
    return if scorer_id.present?

    self.scorer = if user&.default_scorer
                    user.default_scorer
                  else
                    Scorer.system_default_scorer
                  end
  end

  def add_default_try
    return unless tries.empty?

    try_number  = (last_try_number || 0) + 1
    the_try     = tries.create(try_number: try_number)
    the_try.case = self
    tries << the_try
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
      threshold_enbl: query.threshold_enbl,
      case:           self
    )

    if clone_ratings
      query.ratings.each do |rating|
        new_rating = Rating.new(
          doc_id: rating.doc_id,
          rating: rating.rating,
          query:  new_query
        )
        new_query.ratings << new_rating
      end
    end

    queries << new_query
  end

  # rubocop:enable Metrics/MethodLength
end
# rubocop:enable Metrics/ClassLength
