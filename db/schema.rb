# encoding: UTF-8
# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20200113123124) do

  create_table "annotations", force: :cascade do |t|
    t.text     "message",    limit: 65535
    t.string   "source",     limit: 255
    t.integer  "user_id",    limit: 4
    t.datetime "created_at",               null: false
    t.datetime "updated_at",               null: false
  end

  add_index "annotations", ["user_id"], name: "index_annotations_on_user_id", using: :btree

  create_table "case_metadata", force: :cascade do |t|
    t.integer  "user_id",        limit: 4, null: false
    t.integer  "case_id",        limit: 4, null: false
    t.datetime "last_viewed_at"
  end

  add_index "case_metadata", ["case_id"], name: "case_metadata_ibfk_1", using: :btree
  add_index "case_metadata", ["user_id", "case_id"], name: "case_metadata_user_id_case_id_index", using: :btree

  create_table "case_scores", force: :cascade do |t|
    t.integer  "case_id",       limit: 4
    t.integer  "user_id",       limit: 4
    t.integer  "try_id",        limit: 4
    t.float    "score",         limit: 24
    t.boolean  "all_rated"
    t.datetime "created_at"
    t.binary   "queries",       limit: 16777215
    t.integer  "annotation_id", limit: 4
    t.datetime "updated_at"
  end

  add_index "case_scores", ["annotation_id"], name: "index_case_scores_on_annotation_id", using: :btree
  add_index "case_scores", ["case_id"], name: "case_id", using: :btree
  add_index "case_scores", ["user_id"], name: "user_id", using: :btree

  create_table "cases", force: :cascade do |t|
    t.string   "caseName",        limit: 191
    t.string   "searchUrl",       limit: 500
    t.string   "fieldSpec",       limit: 500
    t.integer  "lastTry",         limit: 4
    t.integer  "user_id",         limit: 4
    t.integer  "displayPosition", limit: 4
    t.boolean  "archived"
    t.integer  "scorer_id",       limit: 4
    t.datetime "created_at",                  null: false
    t.datetime "updated_at",                  null: false
    t.string   "scorer_type",     limit: 255
  end

  add_index "cases", ["scorer_type"], name: "index_cases_on_scorer_type", length: {"scorer_type"=>191}, using: :btree
  add_index "cases", ["user_id"], name: "user_id", using: :btree

  create_table "curator_variables", force: :cascade do |t|
    t.string   "name",       limit: 500
    t.float    "value",      limit: 24
    t.integer  "try_id",     limit: 4
    t.datetime "created_at",             null: false
    t.datetime "updated_at",             null: false
  end

  add_index "curator_variables", ["try_id"], name: "try_id", using: :btree

  create_table "default_scorers", force: :cascade do |t|
    t.text     "code",                   limit: 65535
    t.string   "name",                   limit: 255
    t.string   "scale",                  limit: 255
    t.boolean  "manual_max_score",                     default: false
    t.integer  "manual_max_score_value", limit: 4
    t.boolean  "show_scale_labels",                    default: false
    t.text     "scale_with_labels",      limit: 65535
    t.string   "state",                  limit: 255,   default: "draft"
    t.datetime "published_at"
    t.boolean  "default",                              default: false
    t.datetime "created_at",                                             null: false
    t.datetime "updated_at",                                             null: false
  end

  create_table "permissions", force: :cascade do |t|
    t.integer  "user_id",    limit: 4
    t.string   "model_type", limit: 255,                 null: false
    t.string   "action",     limit: 255,                 null: false
    t.boolean  "on",                     default: false
    t.datetime "created_at",                             null: false
    t.datetime "updated_at",                             null: false
  end

  create_table "queries", force: :cascade do |t|
    t.integer  "arranged_next",  limit: 8
    t.integer  "arranged_at",    limit: 8
    t.boolean  "deleted"
    t.string   "query_text",     limit: 191
    t.text     "notes",          limit: 65535
    t.float    "threshold",      limit: 24
    t.boolean  "threshold_enbl"
    t.integer  "case_id",        limit: 4
    t.integer  "scorer_id",      limit: 4
    t.boolean  "scorer_enbl"
    t.datetime "created_at",                   null: false
    t.datetime "updated_at",                   null: false
    t.string   "scorer_type",    limit: 255
    t.text     "options",        limit: 65535
  end

  add_index "queries", ["case_id"], name: "case_id", using: :btree
  add_index "queries", ["scorer_type"], name: "index_queries_on_scorer_type", length: {"scorer_type"=>191}, using: :btree

  create_table "ratings", force: :cascade do |t|
    t.string   "doc_id",     limit: 500
    t.integer  "rating",     limit: 4
    t.integer  "query_id",   limit: 4
    t.datetime "created_at",             null: false
    t.datetime "updated_at",             null: false
  end

  add_index "ratings", ["doc_id"], name: "index_ratings_on_doc_id", length: {"doc_id"=>191}, using: :btree
  add_index "ratings", ["query_id"], name: "query_id", using: :btree

  create_table "scorers", force: :cascade do |t|
    t.text     "code",                   limit: 65535
    t.string   "name",                   limit: 191
    t.integer  "owner_id",               limit: 4
    t.string   "scale",                  limit: 255
    t.boolean  "query_test"
    t.integer  "query_id",               limit: 4
    t.boolean  "manual_max_score",                     default: false
    t.integer  "manual_max_score_value", limit: 4,     default: 100
    t.boolean  "show_scale_labels",                    default: false
    t.text     "scale_with_labels",      limit: 65535
    t.datetime "created_at",                                           null: false
    t.datetime "updated_at",                                           null: false
    t.boolean  "communal",                             default: false
  end

  create_table "snapshot_docs", force: :cascade do |t|
    t.string  "doc_id",            limit: 500
    t.integer "position",          limit: 4
    t.integer "snapshot_query_id", limit: 4
    t.text    "explain",           limit: 16777215
  end

  add_index "snapshot_docs", ["snapshot_query_id"], name: "snapshot_query_id", using: :btree

  create_table "snapshot_queries", force: :cascade do |t|
    t.integer "query_id",    limit: 4
    t.integer "snapshot_id", limit: 4
  end

  add_index "snapshot_queries", ["query_id"], name: "query_id", using: :btree
  add_index "snapshot_queries", ["snapshot_id"], name: "snapshot_id", using: :btree

  create_table "snapshots", force: :cascade do |t|
    t.string   "name",       limit: 250
    t.datetime "created_at"
    t.integer  "case_id",    limit: 4
    t.datetime "updated_at",             null: false
  end

  add_index "snapshots", ["case_id"], name: "case_id", using: :btree

  create_table "teams", force: :cascade do |t|
    t.string   "name",       limit: 255
    t.integer  "owner_id",   limit: 4,   null: false
    t.datetime "created_at",             null: false
    t.datetime "updated_at",             null: false
  end

  add_index "teams", ["name"], name: "index_teams_on_name", length: {"name"=>191}, using: :btree
  add_index "teams", ["owner_id"], name: "owner_id", using: :btree

  create_table "teams_cases", id: false, force: :cascade do |t|
    t.integer "case_id", limit: 4, null: false
    t.integer "team_id", limit: 4, null: false
  end

  add_index "teams_cases", ["case_id"], name: "index_teams_cases_on_case_id", using: :btree
  add_index "teams_cases", ["team_id"], name: "index_teams_cases_on_team_id", using: :btree

  create_table "teams_members", id: false, force: :cascade do |t|
    t.integer "member_id", limit: 4, null: false
    t.integer "team_id",   limit: 4, null: false
  end

  add_index "teams_members", ["member_id"], name: "index_teams_members_on_member_id", using: :btree
  add_index "teams_members", ["team_id"], name: "index_teams_members_on_team_id", using: :btree

  create_table "teams_scorers", id: false, force: :cascade do |t|
    t.integer "scorer_id", limit: 4, null: false
    t.integer "team_id",   limit: 4, null: false
  end

  add_index "teams_scorers", ["scorer_id"], name: "index_teams_scorers_on_scorer_id", using: :btree
  add_index "teams_scorers", ["team_id"], name: "index_teams_scorers_on_team_id", using: :btree

  create_table "tries", force: :cascade do |t|
    t.integer  "tryNo",          limit: 4
    t.text     "queryParams",    limit: 65535
    t.integer  "case_id",        limit: 4
    t.string   "fieldSpec",      limit: 500
    t.string   "searchUrl",      limit: 500
    t.string   "name",           limit: 50
    t.string   "search_engine",  limit: 50,    default: "solr"
    t.boolean  "escape_query",                 default: true
    t.integer  "number_of_rows", limit: 4,     default: 10
    t.datetime "created_at",                                    null: false
    t.datetime "updated_at",                                    null: false
  end

  add_index "tries", ["case_id"], name: "case_id", using: :btree
  add_index "tries", ["tryNo"], name: "ix_queryparam_tryNo", using: :btree

  create_table "users", force: :cascade do |t|
    t.string   "username",               limit: 80
    t.string   "password",               limit: 120
    t.datetime "agreed_time"
    t.boolean  "agreed"
    t.boolean  "firstLogin"
    t.integer  "numLogins",              limit: 4
    t.integer  "scorer_id",              limit: 4
    t.string   "name",                   limit: 255
    t.boolean  "administrator",                      default: false
    t.string   "reset_password_token",   limit: 255
    t.datetime "reset_password_sent_at"
    t.string   "company",                limit: 255
    t.boolean  "locked"
    t.datetime "locked_at"
    t.datetime "created_at",                                         null: false
    t.datetime "updated_at",                                         null: false
    t.integer  "default_scorer_id",      limit: 4
  end

  add_index "users", ["default_scorer_id"], name: "index_users_on_default_scorer_id", using: :btree
  add_index "users", ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true, length: {"reset_password_token"=>191}, using: :btree
  add_index "users", ["username"], name: "ix_user_username", unique: true, using: :btree

  add_foreign_key "annotations", "users"
  add_foreign_key "case_metadata", "cases", name: "case_metadata_ibfk_1"
  add_foreign_key "case_metadata", "users", name: "case_metadata_ibfk_2"
  add_foreign_key "case_scores", "annotations"
  add_foreign_key "case_scores", "cases", name: "case_scores_ibfk_1"
  add_foreign_key "case_scores", "users", name: "case_scores_ibfk_2"
  add_foreign_key "cases", "users", name: "cases_ibfk_1"
  add_foreign_key "curator_variables", "tries", name: "curator_variables_ibfk_1"
  add_foreign_key "queries", "cases", name: "queries_ibfk_1"
  add_foreign_key "ratings", "queries", name: "ratings_ibfk_1"
  add_foreign_key "snapshot_docs", "snapshot_queries", name: "snapshot_docs_ibfk_1"
  add_foreign_key "snapshot_queries", "queries", name: "snapshot_queries_ibfk_1"
  add_foreign_key "snapshot_queries", "snapshots", name: "snapshot_queries_ibfk_2"
  add_foreign_key "snapshots", "cases", name: "snapshots_ibfk_1"
  add_foreign_key "teams", "users", column: "owner_id", name: "teams_ibfk_1"
  add_foreign_key "teams_cases", "cases"
  add_foreign_key "teams_cases", "teams"
  add_foreign_key "teams_members", "teams"
  add_foreign_key "teams_members", "users", column: "member_id"
  add_foreign_key "teams_scorers", "scorers"
  add_foreign_key "teams_scorers", "teams"
  add_foreign_key "tries", "cases", name: "tries_ibfk_1"
  add_foreign_key "users", "default_scorers"
end
