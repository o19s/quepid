# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "snapshots"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "name", type = "string", nullable = true },
#   { name = "created_at", type = "datetime", nullable = true },
#   { name = "case_id", type = "integer", nullable = true },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "try_id", type = "integer", nullable = true },
#   { name = "scorer_id", type = "integer", nullable = true }
# ]
#
# indexes = [
#   { name = "case_id", columns = ["case_id"] },
#   { name = "index_snapshots_on_scorer_id", columns = ["scorer_id"] },
#   { name = "index_snapshots_on_try_id", columns = ["try_id"] }
# ]
#
# foreign_keys = [
#   { column = "case_id", references_table = "cases", references_column = "id", name = "snapshots_ibfk_1" }
# ]
#
# == Polymorphic Associations
# Polymorphic Targets:
# - snapshot_file_attachment (as: :record)
#
# == Notes
# - Missing foreign key constraint on 'try_id' referencing 'tries'
# - Missing foreign key constraint on 'scorer_id' referencing 'scorers'
# - Association 'case' should specify inverse_of
# - Association 'try' should specify inverse_of
# - Association 'scorer' should specify inverse_of
# - Association 'snapshot_queries' should specify inverse_of
# - Association 'snapshot_queries' has N+1 query risk. Consider using includes/preload
# - Association 'snapshot_docs' has N+1 query risk. Consider using includes/preload
# - Column 'name' should probably have NOT NULL constraint
# <rails-lens:schema:end>
class Snapshot < ApplicationRecord
  # Associations
  belongs_to  :case, optional: true # shouldn't be optional!
  belongs_to  :try, optional: true # shouldn't be optional!
  belongs_to  :scorer, optional: true # shouldn't be optional!

  # see the call back delete_associated_objects for special delete logic.
  has_many    :snapshot_queries, dependent: :destroy
  has_many :snapshot_docs,
           through: :snapshot_queries # , dependent: :destroy

  has_one_attached :snapshot_file

  # Validations
  validates :name, presence: true

  # Callbacks
  before_validation :set_defaults
  # before_destroy :delete_associated_objects

  private

  def set_defaults
    self.name = "Snapshot #{Time.zone.now.strftime('%D')}" if name.blank?
  end

  # def delete_associated_objects
  #   puts 'I am about to delete associated objects'
  #   SnapshotDoc.joins(snapshot_query: :snapshot)
  #     .where(snapshot_queries: { snapshot: self })
  #     .delete_all
  #   snapshot_queries.delete_all
  # end
end
