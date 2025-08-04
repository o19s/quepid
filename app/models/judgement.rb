# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "judgements"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_unicode_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "rating", type = "float", nullable = true },
#   { name = "query_doc_pair_id", type = "integer", nullable = false },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "unrateable", type = "boolean", nullable = true, default = "0" },
#   { name = "judge_later", type = "boolean", nullable = true, default = "0" },
#   { name = "explanation", type = "text", nullable = true }
# ]
#
# indexes = [
#   { name = "index_judgements_on_user_id_and_query_doc_pair_id", columns = ["user_id", "query_doc_pair_id"], unique = true },
#   { name = "index_judgements_on_query_doc_pair_id", columns = ["query_doc_pair_id"] }
# ]
#
# foreign_keys = [
#   { column = "query_doc_pair_id", references_table = "query_doc_pairs", references_column = "id", name = "fk_rails_e2d07d22d4" }
# ]
#
# == Notes
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Association 'query_doc_pair' should specify inverse_of
# - Association 'user' should specify inverse_of
# - Column 'rating' should probably have NOT NULL constraint
# - Column 'unrateable' should probably have NOT NULL constraint
# - Column 'judge_later' should probably have NOT NULL constraint
# - Column 'explanation' should probably have NOT NULL constraint
# <rails-lens:schema:end>
class Judgement < ApplicationRecord
  belongs_to :query_doc_pair
  belongs_to :user, optional: true

  validates :user_id, :uniqueness => { :scope => :query_doc_pair_id }, unless: -> { user_id.nil? }
  validates :rating,
            presence: true, unless: :rating_not_required?

  def rating_not_required?
    unrateable || judge_later
  end

  scope :rateable, -> { where(unrateable: false).where(judge_later: false) }

  def check_unrateable_for_rating
  end

  def rating= val
    self.unrateable = false unless val.nil?
    self.judge_later = false unless val.nil?
    write_attribute(:rating, val)
  end

  def mark_unrateable
    self.unrateable = true
    self.rating = nil
  end

  def mark_unrateable!
    mark_unrateable
    save
  end

  def mark_judge_later
    self.judge_later = true
    self.rating = nil
  end

  def mark_judge_later!
    mark_judge_later
    save
  end

  # Based on a judgement, find the previous one made by the
  # same user, but prior to that judgement, or return the most recent judgement!
  def previous_judgement_made
    query_doc_pair.book.judgements.where(judgements: { user: user }).where(judgements: { updated_at: ...(updated_at.nil? ? DateTime.current : updated_at) }).reorder('judgements.updated_at DESC').first
  end
end
