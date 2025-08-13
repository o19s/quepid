# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "books"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_unicode_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "scorer_id", type = "integer", nullable = true },
#   { name = "selection_strategy_id", type = "integer", nullable = false },
#   { name = "name", type = "string", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "support_implicit_judgements", type = "boolean", nullable = true },
#   { name = "show_rank", type = "boolean", nullable = true, default = "0" },
#   { name = "owner_id", type = "integer", nullable = true },
#   { name = "export_job", type = "string", nullable = true },
#   { name = "import_job", type = "string", nullable = true },
#   { name = "populate_job", type = "string", nullable = true }
# ]
#
# indexes = [
#   { name = "index_books_owner_id", columns = ["owner_id"] },
#   { name = "index_books_on_selection_strategy_id", columns = ["selection_strategy_id"] }
# ]
#
# foreign_keys = [
#   { column = "selection_strategy_id", references_table = "selection_strategies", references_column = "id", name = "fk_rails_24f1c667d7" }
# ]
#
# == Polymorphic Associations
# Polymorphic Targets:
# - import_file_attachment (as: :record)
# - export_file_attachment (as: :record)
# - populate_file_attachment (as: :record)
#
# == Notes
# - Missing index on foreign key 'scorer_id'
# - Missing foreign key constraint on 'owner_id' referencing 'users'
# - Missing foreign key constraint on 'scorer_id' referencing 'scorers'
# - Association 'owner' should specify inverse_of
# - Association 'query_doc_pairs' should specify inverse_of
# - Association 'cases' should specify inverse_of
# - Association 'metadata' should specify inverse_of
# - Association 'query_doc_pairs' has N+1 query risk. Consider using includes/preload
# - Association 'judgements' has N+1 query risk. Consider using includes/preload
# - Association 'judges' has N+1 query risk. Consider using includes/preload
# - Association 'cases' has N+1 query risk. Consider using includes/preload
# - Association 'rated_query_doc_pairs' has N+1 query risk. Consider using includes/preload
# - Association 'metadata' has N+1 query risk. Consider using includes/preload
# - Column 'name' should probably have NOT NULL constraint
# - Column 'support_implicit_judgements' should probably have NOT NULL constraint
# - Column 'show_rank' should probably have NOT NULL constraint
# - Column 'export_job' should probably have NOT NULL constraint
# - Column 'import_job' should probably have NOT NULL constraint
# - Column 'populate_job' should probably have NOT NULL constraint
# - Boolean column 'support_implicit_judgements' should have a default value
# <rails-lens:schema:end>
class Book < ApplicationRecord
  # Associations
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_books'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :owner,
             class_name: 'User', optional: true

  # belongs_to :ai_judge,
  #           class_name: 'User', optional: true
  #
  # has_many :users, dependent: :destroy
  # has_many :ai_judges, through: :ai_judges

  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :ai_judges,
                          class_name: 'User',
                          join_table: 'books_ai_judges'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :selection_strategy
  belongs_to :scorer
  has_many :query_doc_pairs, dependent: :delete_all, autosave: true

  has_many   :judgements,
             through: :query_doc_pairs

  has_many :judges, -> { distinct }, through: :judgements, class_name: 'User', source: :user

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
  has_one_attached :populate_file

  after_destroy :delete_attachments

  # Scopes
  include ForUserScope

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

  def delete_attachments
    import_file.purge_later
    export_file.purge_later
    populate_file.purge_later
  end
end
