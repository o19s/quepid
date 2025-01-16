# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_01_15_111655) do
  create_table "active_storage_attachments", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_db_files", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "ref", null: false
    t.binary "data", size: :long, null: false
    t.datetime "created_at", null: false
    t.index ["ref"], name: "index_active_storage_db_files_on_ref", unique: true
  end

  create_table "active_storage_variant_records", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ahoy_events", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "visit_id"
    t.bigint "user_id"
    t.string "name"
    t.json "properties"
    t.datetime "time"
    t.index ["name", "time"], name: "index_ahoy_events_on_name_and_time"
    t.index ["user_id"], name: "index_ahoy_events_on_user_id"
    t.index ["visit_id"], name: "index_ahoy_events_on_visit_id"
  end

  create_table "ahoy_visits", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "visit_token"
    t.string "visitor_token"
    t.bigint "user_id"
    t.string "ip"
    t.text "user_agent"
    t.text "referrer"
    t.string "referring_domain"
    t.text "landing_page"
    t.string "browser"
    t.string "os"
    t.string "device_type"
    t.string "country"
    t.string "region"
    t.string "city"
    t.float "latitude"
    t.float "longitude"
    t.string "utm_source"
    t.string "utm_medium"
    t.string "utm_term"
    t.string "utm_content"
    t.string "utm_campaign"
    t.string "app_version"
    t.string "os_version"
    t.string "platform"
    t.datetime "started_at"
    t.index ["user_id"], name: "index_ahoy_visits_on_user_id"
    t.index ["visit_token"], name: "index_ahoy_visits_on_visit_token", unique: true
    t.index ["visitor_token", "started_at"], name: "index_ahoy_visits_on_visitor_token_and_started_at"
  end

  create_table "annotations", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.text "message"
    t.string "source"
    t.integer "user_id"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["user_id"], name: "index_annotations_on_user_id"
  end

  create_table "announcement_viewed", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.integer "announcement_id"
    t.integer "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["announcement_id"], name: "index_announcement_viewed_announcement_id"
  end

  create_table "announcements", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.text "text"
    t.integer "author_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "live", default: false
    t.index ["author_id"], name: "index_announcements_author_id"
  end

  create_table "api_keys", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.integer "user_id"
    t.string "token_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token_digest"], name: "index_api_keys_on_token_digest"
    t.index ["user_id"], name: "index_api_keys_user_id"
  end

  create_table "blazer_audits", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "user_id"
    t.bigint "query_id"
    t.text "statement"
    t.string "data_source"
    t.datetime "created_at"
    t.index ["query_id"], name: "index_blazer_audits_on_query_id"
    t.index ["user_id"], name: "index_blazer_audits_on_user_id"
  end

  create_table "blazer_checks", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "creator_id"
    t.bigint "query_id"
    t.string "state"
    t.string "schedule"
    t.text "emails"
    t.text "slack_channels"
    t.string "check_type"
    t.text "message"
    t.datetime "last_run_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_blazer_checks_on_creator_id"
    t.index ["query_id"], name: "index_blazer_checks_on_query_id"
  end

  create_table "blazer_dashboard_queries", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "dashboard_id"
    t.bigint "query_id"
    t.integer "position"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["dashboard_id"], name: "index_blazer_dashboard_queries_on_dashboard_id"
    t.index ["query_id"], name: "index_blazer_dashboard_queries_on_query_id"
  end

  create_table "blazer_dashboards", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "creator_id"
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_blazer_dashboards_on_creator_id"
  end

  create_table "blazer_queries", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "creator_id"
    t.string "name"
    t.text "description"
    t.text "statement"
    t.string "data_source"
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_blazer_queries_on_creator_id"
  end

  create_table "book_metadata", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.integer "user_id"
    t.bigint "book_id", null: false
    t.datetime "last_viewed_at"
    t.index ["book_id"], name: "index_book_metadata_on_book_id"
    t.index ["user_id", "book_id"], name: "index_book_metadata_on_user_id_and_book_id"
  end

  create_table "books", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.integer "scorer_id"
    t.bigint "selection_strategy_id", null: false
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "support_implicit_judgements"
    t.boolean "show_rank", default: false
    t.integer "owner_id"
    t.string "export_job"
    t.string "import_job"
    t.string "populate_job"
    t.index ["owner_id"], name: "index_books_owner_id"
    t.index ["selection_strategy_id"], name: "index_books_on_selection_strategy_id"
  end

  create_table "books_ai_judges", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["book_id", "user_id"], name: "index_books_ai_judges_on_book_id_and_user_id", unique: true
    t.index ["book_id"], name: "index_books_ai_judges_on_book_id"
    t.index ["user_id"], name: "index_books_ai_judges_on_user_id"
  end

  create_table "case_metadata", id: :integer, charset: "latin1", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "case_id", null: false
    t.datetime "last_viewed_at", precision: nil
    t.index ["case_id"], name: "case_metadata_ibfk_1"
    t.index ["last_viewed_at", "case_id"], name: "idx_last_viewed_case"
    t.index ["user_id", "case_id"], name: "case_metadata_user_id_case_id_index"
  end

  create_table "case_scores", id: :integer, charset: "latin1", force: :cascade do |t|
    t.integer "case_id"
    t.integer "user_id"
    t.integer "try_id"
    t.float "score"
    t.boolean "all_rated"
    t.datetime "created_at", precision: nil
    t.binary "queries", size: :medium
    t.integer "annotation_id"
    t.datetime "updated_at", precision: nil
    t.index ["annotation_id"], name: "index_case_scores_annotation_id", unique: true
    t.index ["case_id"], name: "case_id"
    t.index ["updated_at", "created_at", "id"], name: "support_last_score"
    t.index ["user_id"], name: "user_id"
  end

  create_table "cases", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.string "case_name", limit: 191
    t.integer "last_try_number"
    t.integer "owner_id"
    t.boolean "archived"
    t.integer "scorer_id"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.integer "book_id"
    t.boolean "public"
    t.json "options"
    t.boolean "nightly"
    t.index ["book_id"], name: "index_cases_book_id"
    t.index ["owner_id", "archived"], name: "idx_owner_archived"
    t.index ["owner_id"], name: "user_id"
  end

  create_table "curator_variables", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "name", limit: 500
    t.float "value"
    t.integer "try_id"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["try_id"], name: "try_id"
  end

  create_table "judgements", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.integer "user_id"
    t.float "rating"
    t.bigint "query_doc_pair_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "unrateable", default: false
    t.boolean "judge_later", default: false
    t.text "explanation"
    t.index ["query_doc_pair_id"], name: "index_judgements_on_query_doc_pair_id"
    t.index ["user_id", "query_doc_pair_id"], name: "index_judgements_on_user_id_and_query_doc_pair_id", unique: true
  end

  create_table "permissions", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.integer "user_id"
    t.string "model_type", null: false
    t.string "action", null: false
    t.boolean "on", default: false
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["user_id"], name: "index_permissions_user_id"
  end

  create_table "queries", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.bigint "arranged_next"
    t.bigint "arranged_at"
    t.string "query_text", limit: 2048
    t.text "notes"
    t.integer "case_id"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.text "options", collation: "utf8mb3_bin"
    t.string "information_need"
    t.index ["case_id"], name: "case_id"
  end

  create_table "query_doc_pairs", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.string "query_text", limit: 2048
    t.integer "position"
    t.text "document_fields", size: :medium, collation: "utf8mb4_0900_ai_ci"
    t.bigint "book_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "doc_id", limit: 500
    t.string "information_need"
    t.text "notes"
    t.text "options", collation: "utf8mb3_bin"
    t.index ["book_id"], name: "index_query_doc_pairs_on_book_id"
  end

  create_table "ratings", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "doc_id", limit: 500
    t.float "rating"
    t.integer "query_id"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.integer "user_id"
    t.index ["doc_id"], name: "index_ratings_on_doc_id", length: 191
    t.index ["query_id"], name: "query_id"
  end

  create_table "scorers", id: :integer, charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.text "code"
    t.string "name"
    t.integer "owner_id"
    t.string "scale"
    t.boolean "show_scale_labels", default: false
    t.text "scale_with_labels"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.boolean "communal", default: false
    t.index ["owner_id"], name: "index_scorers_owner_id"
  end

  create_table "search_endpoints", charset: "utf8mb3", force: :cascade do |t|
    t.string "name"
    t.integer "owner_id"
    t.string "search_engine", limit: 50
    t.string "endpoint_url", limit: 500
    t.string "api_method"
    t.string "custom_headers", limit: 6000
    t.boolean "archived", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "basic_auth_credential"
    t.text "mapper_code"
    t.boolean "proxy_requests", default: false
    t.json "options"
    t.index ["owner_id", "id"], name: "index_search_endpoints_on_owner_id_and_id"
  end

  create_table "selection_strategies", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "description"
  end

  create_table "snapshot_docs", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "doc_id", limit: 500
    t.integer "position"
    t.integer "snapshot_query_id"
    t.text "explain", size: :medium, collation: "utf8mb4_0900_ai_ci"
    t.boolean "rated_only", default: false
    t.text "fields", size: :medium, collation: "utf8mb4_0900_ai_ci"
    t.index ["snapshot_query_id"], name: "snapshot_query_id"
  end

  create_table "snapshot_queries", id: :integer, charset: "latin1", force: :cascade do |t|
    t.integer "query_id"
    t.integer "snapshot_id"
    t.float "score"
    t.boolean "all_rated"
    t.integer "number_of_results"
    t.integer "response_status"
    t.binary "response_body", size: :long
    t.index ["query_id"], name: "query_id"
    t.index ["snapshot_id"], name: "snapshot_id"
  end

  create_table "snapshots", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "name", limit: 250
    t.datetime "created_at", precision: nil
    t.integer "case_id"
    t.datetime "updated_at", precision: nil, null: false
    t.bigint "try_id"
    t.bigint "scorer_id"
    t.index ["case_id"], name: "case_id"
    t.index ["scorer_id"], name: "index_snapshots_on_scorer_id"
    t.index ["try_id"], name: "index_snapshots_on_try_id"
  end

  create_table "solid_cable_messages", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.binary "channel", limit: 1024, null: false
    t.binary "payload", size: :long, null: false
    t.datetime "created_at", null: false
    t.bigint "channel_hash", null: false
    t.index ["channel"], name: "index_solid_cable_messages_on_channel"
    t.index ["channel_hash"], name: "index_solid_cable_messages_on_channel_hash"
    t.index ["created_at"], name: "index_solid_cable_messages_on_created_at"
  end

  create_table "solid_queue_blocked_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.string "concurrency_key", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.text "error"
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "queue_name", null: false
    t.string "class_name", null: false
    t.text "arguments"
    t.integer "priority", default: 0, null: false
    t.string "active_job_id"
    t.datetime "scheduled_at"
    t.datetime "finished_at"
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "queue_name", null: false
    t.datetime "created_at", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.bigint "supervisor_id"
    t.integer "pid", null: false
    t.string "hostname"
    t.text "metadata"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "task_key", null: false
    t.datetime "run_at", null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "key", null: false
    t.string "schedule", null: false
    t.string "command", limit: 2048
    t.string "class_name"
    t.text "arguments"
    t.string "queue_name"
    t.integer "priority", default: 0
    t.boolean "static", default: true, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "scheduled_at", null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "key", null: false
    t.integer "value", default: 1, null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "teams", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "name", collation: "utf8mb3_bin"
    t.integer "owner_id", null: false
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["name"], name: "index_teams_on_name", length: 191
    t.index ["owner_id"], name: "owner_id"
  end

  create_table "teams_books", id: false, charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.bigint "team_id", null: false
  end

  create_table "teams_cases", primary_key: ["case_id", "team_id"], charset: "latin1", force: :cascade do |t|
    t.integer "case_id", null: false
    t.integer "team_id", null: false
    t.index ["case_id"], name: "index_teams_cases_on_case_id"
    t.index ["team_id"], name: "index_teams_cases_on_team_id"
  end

  create_table "teams_members", primary_key: ["member_id", "team_id"], charset: "latin1", force: :cascade do |t|
    t.integer "member_id", null: false
    t.integer "team_id", null: false
    t.index ["member_id", "team_id"], name: "index_teams_members_on_member_id_and_team_id"
    t.index ["member_id"], name: "index_teams_members_on_member_id"
    t.index ["team_id"], name: "index_teams_members_on_team_id"
  end

  create_table "teams_scorers", primary_key: ["scorer_id", "team_id"], charset: "latin1", force: :cascade do |t|
    t.integer "scorer_id", null: false
    t.integer "team_id", null: false
    t.index ["scorer_id"], name: "index_teams_scorers_on_scorer_id"
    t.index ["team_id"], name: "index_teams_scorers_on_team_id"
  end

  create_table "teams_search_endpoints", id: false, charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "search_endpoint_id", null: false
    t.bigint "team_id", null: false
    t.index ["search_endpoint_id", "team_id"], name: "index_teams_search_endpoints_on_search_endpoint_id_and_team_id"
  end

  create_table "tries", id: :integer, charset: "latin1", force: :cascade do |t|
    t.integer "try_number"
    t.string "query_params", limit: 20000
    t.integer "case_id"
    t.string "field_spec", limit: 500
    t.string "name", limit: 50
    t.boolean "escape_query", default: true
    t.integer "number_of_rows", default: 10
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.string "ancestry", limit: 3072
    t.bigint "search_endpoint_id"
    t.index ["case_id"], name: "case_id"
    t.index ["search_endpoint_id"], name: "index_tries_on_search_endpoint_id"
    t.index ["try_number"], name: "ix_queryparam_tryNo"
  end

  create_table "users", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "email", limit: 80
    t.string "password", limit: 120
    t.datetime "agreed_time", precision: nil
    t.boolean "agreed"
    t.integer "num_logins"
    t.string "name"
    t.boolean "administrator", default: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at", precision: nil
    t.string "company"
    t.boolean "locked"
    t.datetime "locked_at", precision: nil
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.integer "default_scorer_id"
    t.boolean "email_marketing", default: false, null: false
    t.string "invitation_token"
    t.datetime "invitation_created_at", precision: nil
    t.datetime "invitation_sent_at", precision: nil
    t.datetime "invitation_accepted_at", precision: nil
    t.integer "invitation_limit"
    t.integer "invited_by_id"
    t.integer "invitations_count", default: 0
    t.boolean "completed_case_wizard", default: false, null: false
    t.string "stored_raw_invitation_token"
    t.string "profile_pic", limit: 4000
    t.string "system_prompt", limit: 4000
    t.string "openai_key"
    t.index ["default_scorer_id"], name: "index_users_on_default_scorer_id"
    t.index ["email"], name: "ix_user_username", unique: true
    t.index ["invitation_token"], name: "index_users_on_invitation_token", unique: true, length: 191
    t.index ["invited_by_id"], name: "index_users_on_invited_by_id"
    t.index ["name"], name: "index_users_on_name"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true, length: 191
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "annotations", "users"
  add_foreign_key "book_metadata", "books"
  add_foreign_key "books", "selection_strategies"
  add_foreign_key "books_ai_judges", "books"
  add_foreign_key "case_metadata", "cases", name: "case_metadata_ibfk_1"
  add_foreign_key "case_metadata", "users", name: "case_metadata_ibfk_2"
  add_foreign_key "case_scores", "annotations"
  add_foreign_key "case_scores", "cases", name: "case_scores_ibfk_1"
  add_foreign_key "case_scores", "users", name: "case_scores_ibfk_2"
  add_foreign_key "cases", "users", column: "owner_id", name: "cases_ibfk_1"
  add_foreign_key "judgements", "query_doc_pairs"
  add_foreign_key "queries", "cases", name: "queries_ibfk_1"
  add_foreign_key "query_doc_pairs", "books"
  add_foreign_key "ratings", "queries", name: "ratings_ibfk_1"
  add_foreign_key "snapshot_docs", "snapshot_queries", name: "snapshot_docs_ibfk_1"
  add_foreign_key "snapshot_queries", "queries", name: "snapshot_queries_ibfk_1"
  add_foreign_key "snapshot_queries", "snapshots", name: "snapshot_queries_ibfk_2"
  add_foreign_key "snapshots", "cases", name: "snapshots_ibfk_1"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "teams", "users", column: "owner_id", name: "teams_ibfk_1"
  add_foreign_key "teams_cases", "cases"
  add_foreign_key "teams_cases", "teams"
  add_foreign_key "teams_members", "teams"
  add_foreign_key "teams_members", "users", column: "member_id"
  add_foreign_key "teams_scorers", "scorers"
  add_foreign_key "teams_scorers", "teams"
  add_foreign_key "tries", "cases", name: "tries_ibfk_1"
  add_foreign_key "users", "scorers", column: "default_scorer_id"
end
