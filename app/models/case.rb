# frozen_string_literal: true

# == Schema Information
#
# Table name: cases
#
#  id              :integer          not null, primary key
#  archived        :boolean
#  case_name       :string(191)
#  last_try_number :integer
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  book_id         :integer
#  owner_id        :integer
#  scorer_id       :integer
#
# Indexes
#
#  user_id  (owner_id)
#
# Foreign Keys
#
#  cases_ibfk_1  (owner_id => users.id)
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

  belongs_to :owner,
             class_name: 'User', optional: true

  has_many   :tries,     -> { order(try_number: :desc) },
             dependent:  :destroy,
             inverse_of: :case

  has_many   :metadata,
             dependent: :destroy

  # has_many   :ratings,  # we don't actually need this.
  #           through: :queries

  # rubocop:disable Rails/InverseOf
  has_many   :queries,  -> { order(arranged_at: :asc) },
             autosave:  true,
             dependent: :destroy
  # rubocop:enable Rails/InverseOf

  has_many   :scores,   -> { order(updated_at:  :desc) },
             dependent:  :destroy,
             inverse_of: :case

  has_many   :snapshots,
             dependent: :destroy

  has_many   :annotations,
             through:   :scores,
             dependent: :destroy

  belongs_to  :book, optional: true

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

  scope :for_user_via_teams, ->(user) {
    joins('
      LEFT OUTER JOIN `teams_cases` ON `teams_cases`.`case_id` = `cases`.`id`
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_cases`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
    ').where('
        `teams_members`.`member_id` = ?
    ', user.id)
  }

  scope :for_user_directly_owned, ->(user) {
    where('
        `cases`.`owner_id` = ?
    ',  user.id)
  }

  scope :for_user, ->(user) {
    ids = for_user_via_teams(user).pluck(:id) + for_user_directly_owned(user).pluck(:id)
    where(id: ids.uniq)
  }

  # Not proud of this method, but it's the only way I can get the dependent
  # objects of a Case to actually delete!
  def really_destroy
    snapshots.destroy_all
    queries.unscoped.where(case_id: id).destroy_all
    tries.destroy_all
    destroy
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/ParameterLists
  def clone_case original_case, user, try: nil, clone_queries: false, clone_ratings: false, preserve_history: false
    transaction do
      self.owner = user

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

      self.scorer = original_case.scorer

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

    self.scorer = if owner&.default_scorer
                    owner.default_scorer
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
      escape_query:   the_try.escape_query,
      api_method:     the_try.api_method,
      field_spec:     the_try.field_spec,
      name:           the_try.name,
      query_params:   the_try.query_params,
      search_engine:  the_try.search_engine,
      search_url:     the_try.search_url,
      number_of_rows: the_try.number_of_rows,
      try_number:     preserve_history ? the_try.try_number : 0
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

  def clone_query query, clone_ratings
    new_query = query.dup

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
end
# rubocop:enable Metrics/ClassLength
