# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "cases"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_general_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "case_name", type = "string", nullable = true },
#   { name = "last_try_number", type = "integer", nullable = true },
#   { name = "owner_id", type = "integer", nullable = true },
#   { name = "archived", type = "boolean", nullable = true },
#   { name = "scorer_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "book_id", type = "integer", nullable = true },
#   { name = "public", type = "boolean", nullable = true },
#   { name = "options", type = "json", nullable = true },
#   { name = "nightly", type = "boolean", nullable = true }
# ]
#
# indexes = [
#   { name = "index_cases_book_id", columns = ["book_id"] },
#   { name = "idx_owner_archived", columns = ["owner_id", "archived"] },
#   { name = "user_id", columns = ["owner_id"] }
# ]
#
# foreign_keys = [
#   { column = "owner_id", references_table = "users", references_column = "id", name = "cases_ibfk_1" }
# ]
#
# == Notes
# - Missing index on foreign key 'scorer_id'
# - Index 'idx_owner_archived' might be redundant with 'user_id'
# - Missing foreign key constraint on 'scorer_id' referencing 'scorers'
# - Missing foreign key constraint on 'book_id' referencing 'books'
# - Association 'owner' should specify inverse_of
# - Association 'metadata' should specify inverse_of
# - Association 'queries' should specify inverse_of
# - Association 'snapshots' should specify inverse_of
# - Association 'book' should specify inverse_of
# - Association 'tries' has N+1 query risk. Consider using includes/preload
# - Association 'metadata' has N+1 query risk. Consider using includes/preload
# - Association 'queries' has N+1 query risk. Consider using includes/preload
# - Association 'ratings' has N+1 query risk. Consider using includes/preload
# - Association 'scores' has N+1 query risk. Consider using includes/preload
# - Association 'snapshots' has N+1 query risk. Consider using includes/preload
# - Association 'annotations' has N+1 query risk. Consider using includes/preload
# - Column 'case_name' should probably have NOT NULL constraint
# - Column 'archived' should probably have NOT NULL constraint
# - Column 'public' should probably have NOT NULL constraint
# - Column 'options' should probably have NOT NULL constraint
# - Column 'nightly' should probably have NOT NULL constraint
# - Boolean column 'archived' should have a default value
# - Boolean column 'public' should have a default value
# - Boolean column 'nightly' should have a default value
# <rails-lens:schema:end>
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
             class_name: 'CaseMetadatum',
             dependent:  :destroy

  # rubocop:disable Rails/InverseOf
  has_many   :queries,  -> { order(arranged_at: :asc) },
             autosave:  true,
             dependent: :destroy
  # rubocop:enable Rails/InverseOf

  has_many   :ratings,
             through: :queries

  has_many   :scores, -> { order(updated_at: :desc) },
             dependent:  :destroy,
             inverse_of: :case

  has_many   :snapshots,
             dependent: :destroy

  has_many   :annotations,
             through:   :scores,
             dependent: :destroy

  belongs_to :book, optional: true

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
  include ForUserScope

  scope :not_archived, -> { where('`cases`.`archived` = false OR `cases`.`archived` IS NULL') }

  scope :public_cases, -> { where(public: true) }

  scope :nightly_run, -> { where(nightly: true) }

  # load up the queries count for the case, alternative to counter_cache
  scope :with_counts, -> {
                        select <<~SQL.squish
                          cases.*,
                          (
                            SELECT COUNT(queries.id) FROM queries
                            WHERE case_id = cases.id
                          ) AS queries_count
                        SQL
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

  def public?
    true == public
  end

  def mark_public
    self.public = true
  end

  def mark_private
    self.public = false
  end

  def mark_public!
    mark_public
    save
  end

  def rearrange_queries
    Arrangement::List.sequence queries
  end

  def last_score
    scores.last_one
    # scores.last
    # scores.first
  end

  def first_score
    scores.last
  end

  def public_id
    Rails.application.message_verifier('magic').generate(id)
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

  def clone_try the_try, preserve_history
    new_try = the_try.dup
    new_try.try_number = preserve_history ? the_try.try_number : 1
    tries << new_try

    the_try.curator_variables.each do |a_curator_variable|
      new_curator_variable = CuratorVariable.new(
        name:  a_curator_variable.name,
        value: a_curator_variable.value
      )
      new_try.curator_variables << new_curator_variable
    end
  end

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
