# frozen_string_literal: true

# MySQL scopes index names per-table, so several older migrations reused the
# bare column name (e.g. "case_id") as the index name across multiple tables.
# SQLite requires index names to be unique across the whole database, so
# db:schema:load fails there with "index case_id already exists" etc. Rename
# these to Rails' standard index_<table>_on_<column> convention, which is
# unique by construction and portable to both adapters.
class RenameGloballyCollidingIndexNames < ActiveRecord::Migration[8.1]
  RENAMES = [
    [ :case_scores,      "case_id",  "index_case_scores_on_case_id" ],
    [ :case_scores,      "user_id",  "index_case_scores_on_user_id" ],
    [ :cases,            "user_id",  "index_cases_on_owner_id" ],
    [ :queries,          "case_id",  "index_queries_on_case_id" ],
    [ :ratings,          "query_id", "index_ratings_on_query_id" ],
    [ :snapshot_queries, "query_id", "index_snapshot_queries_on_query_id" ],
    [ :snapshots,        "case_id",  "index_snapshots_on_case_id" ],
    [ :tries,            "case_id",  "index_tries_on_case_id" ]
  ].freeze

  def up
    RENAMES.each do |table, old_name, new_name|
      rename_index table, old_name, new_name
    end
  end

  def down
    RENAMES.each do |table, old_name, new_name|
      rename_index table, new_name, old_name
    end
  end
end
