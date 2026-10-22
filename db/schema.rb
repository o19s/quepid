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

ActiveRecord::Schema[8.1].define(version: 2026_10_05_192545) do
  create_table "active_storage_attachments", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_db_files", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.binary "data", size: :long, null: false
    t.string "ref", null: false
    t.index ["ref"], name: "index_active_storage_db_files_on_ref", unique: true
  end

  create_table "active_storage_variant_records", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ahoy_events", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "name"
    t.json "properties"
    t.datetime "time"
    t.bigint "user_id"
    t.bigint "visit_id"
    t.index ["name", "time"], name: "index_ahoy_events_on_name_and_time"
    t.index ["user_id"], name: "index_ahoy_events_on_user_id"
    t.index ["visit_id"], name: "index_ahoy_events_on_visit_id"
  end

  create_table "ahoy_visits", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "app_version"
    t.string "browser"
    t.string "city"
    t.string "country"
    t.string "device_type"
    t.string "ip"
    t.text "landing_page"
    t.float "latitude"
    t.float "longitude"
    t.string "os"
    t.string "os_version"
    t.string "platform"
    t.text "referrer"
    t.string "referring_domain"
    t.string "region"
    t.datetime "started_at"
    t.text "user_agent"
    t.bigint "user_id"
    t.string "utm_campaign"
    t.string "utm_content"
    t.string "utm_medium"
    t.string "utm_source"
    t.string "utm_term"
    t.string "visit_token"
    t.string "visitor_token"
    t.index ["user_id"], name: "index_ahoy_visits_on_user_id"
    t.index ["visit_token"], name: "index_ahoy_visits_on_visit_token", unique: true
    t.index ["visitor_token", "started_at"], name: "index_ahoy_visits_on_visitor_token_and_started_at"
  end

  create_table "annotations", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.datetime "created_at", precision: nil, null: false
    t.text "message"
    t.string "source"
    t.datetime "updated_at", precision: nil, null: false
    t.integer "user_id"
    t.index ["user_id"], name: "index_annotations_on_user_id"
  end

  create_table "announcement_viewed", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.integer "announcement_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.index ["announcement_id"], name: "index_announcement_viewed_announcement_id"
  end

  create_table "announcements", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.integer "author_id"
    t.datetime "created_at", null: false
    t.date "expiration_date", null: false
    t.date "publish_date", null: false
    t.text "text", collation: "utf8mb4_unicode_ci"
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_announcements_author_id"
  end

  create_table "api_keys", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "token_digest", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.index ["token_digest"], name: "index_api_keys_on_token_digest"
    t.index ["user_id"], name: "index_api_keys_user_id"
  end

  create_table "blazer_audits", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at"
    t.string "data_source"
    t.bigint "query_id"
    t.text "statement"
    t.bigint "user_id"
    t.index ["query_id"], name: "index_blazer_audits_on_query_id"
    t.index ["user_id"], name: "index_blazer_audits_on_user_id"
  end

  create_table "blazer_checks", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "check_type"
    t.datetime "created_at", null: false
    t.bigint "creator_id"
    t.text "emails"
    t.datetime "last_run_at"
    t.text "message"
    t.bigint "query_id"
    t.string "schedule"
    t.text "slack_channels"
    t.string "state"
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_blazer_checks_on_creator_id"
    t.index ["query_id"], name: "index_blazer_checks_on_query_id"
  end

  create_table "blazer_dashboard_queries", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "dashboard_id"
    t.integer "position"
    t.bigint "query_id"
    t.datetime "updated_at", null: false
    t.index ["dashboard_id"], name: "index_blazer_dashboard_queries_on_dashboard_id"
    t.index ["query_id"], name: "index_blazer_dashboard_queries_on_query_id"
  end

  create_table "blazer_dashboards", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "creator_id"
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_blazer_dashboards_on_creator_id"
  end

  create_table "blazer_queries", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "creator_id"
    t.string "data_source"
    t.text "description"
    t.string "name"
    t.text "statement"
    t.string "status"
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_blazer_queries_on_creator_id"
  end

  create_table "book_metadata", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.datetime "last_viewed_at"
    t.integer "user_id"
    t.index ["book_id"], name: "index_book_metadata_on_book_id"
    t.index ["user_id", "book_id"], name: "index_book_metadata_on_user_id_and_book_id"
  end

  create_table "books", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.boolean "archived", default: false, null: false
    t.datetime "created_at", null: false
    t.string "export_job"
    t.string "import_job"
    t.string "name"
    t.integer "owner_id"
    t.string "populate_job"
    t.integer "rank_depth"
    t.string "scale"
    t.text "scale_with_labels"
    t.text "scoring_guidelines"
    t.boolean "show_rank", default: false
    t.boolean "support_implicit_judgements"
    t.datetime "updated_at", null: false
    t.index ["owner_id"], name: "index_books_owner_id"
  end

  create_table "books_ai_judges", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.boolean "auto_run", default: false, null: false
    t.bigint "book_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["book_id", "user_id"], name: "index_books_ai_judges_on_book_id_and_user_id", unique: true
    t.index ["book_id"], name: "index_books_ai_judges_on_book_id"
    t.index ["user_id"], name: "index_books_ai_judges_on_user_id"
  end

  create_table "case_metadata", id: :integer, charset: "latin1", force: :cascade do |t|
    t.integer "case_id", null: false
    t.datetime "last_viewed_at", precision: nil
    t.integer "user_id", null: false
    t.index ["case_id"], name: "case_metadata_ibfk_1"
    t.index ["last_viewed_at", "case_id"], name: "idx_last_viewed_case"
    t.index ["user_id", "case_id"], name: "case_metadata_user_id_case_id_index"
  end

  create_table "case_scores", id: :integer, charset: "latin1", force: :cascade do |t|
    t.boolean "all_rated"
    t.integer "annotation_id"
    t.integer "case_id"
    t.datetime "created_at", precision: nil
    t.binary "queries", size: :medium
    t.float "score"
    t.bigint "scorer_id"
    t.integer "try_id"
    t.datetime "updated_at", precision: nil
    t.integer "user_id"
    t.index ["annotation_id"], name: "index_case_scores_annotation_id", unique: true
    t.index ["case_id", "updated_at", "created_at", "id"], name: "index_case_scores_on_case_and_latest"
    t.index ["case_id"], name: "index_case_scores_on_case_id"
    t.index ["scorer_id"], name: "index_case_scores_on_scorer_id"
    t.index ["user_id"], name: "index_case_scores_on_user_id"
  end

  create_table "cases", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.boolean "archived"
    t.boolean "auto_populate_book_pairs", default: false, null: false
    t.boolean "auto_populate_case_judgements", default: true, null: false
    t.integer "book_id"
    t.string "case_name", limit: 191
    t.datetime "created_at", precision: nil, null: false
    t.integer "last_try_number"
    t.boolean "nightly"
    t.json "options"
    t.integer "owner_id"
    t.boolean "public"
    t.integer "scorer_id"
    t.datetime "updated_at", precision: nil, null: false
    t.index ["book_id"], name: "index_cases_book_id"
    t.index ["owner_id", "archived"], name: "idx_owner_archived"
    t.index ["owner_id"], name: "index_cases_on_owner_id"
  end

  create_table "curator_variables", id: :integer, charset: "latin1", force: :cascade do |t|
    t.datetime "created_at", precision: nil, null: false
    t.string "name", limit: 500
    t.integer "try_id"
    t.datetime "updated_at", precision: nil, null: false
    t.float "value"
    t.index ["try_id"], name: "try_id"
  end

  create_table "judgements", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "explanation"
    t.boolean "judge_later", default: false
    t.bigint "query_doc_pair_id", null: false
    t.float "rating"
    t.boolean "unrateable", default: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.bigint "escalated_from_judgement_id"
    t.index ["escalated_from_judgement_id"], name: "index_judgements_on_escalated_from_judgement_id", unique: true
    t.index ["query_doc_pair_id"], name: "index_judgements_on_query_doc_pair_id"
    t.index ["user_id", "query_doc_pair_id"], name: "index_judgements_on_user_id_and_query_doc_pair_id", unique: true
  end

  create_table "mapper_wizard_states", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "basic_auth_credential", limit: 4000
    t.datetime "created_at", null: false
    t.text "custom_headers"
    t.text "docs_mapper"
    t.text "html_content", size: :medium
    t.string "http_method", limit: 10, default: "GET"
    t.text "number_of_results_mapper"
    t.string "search_url", limit: 2000
    t.text "test_query"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["created_at"], name: "index_mapper_wizard_states_on_created_at"
    t.index ["user_id"], name: "index_mapper_wizard_states_on_user_id"
  end

  create_table "queries", id: :integer, charset: "utf8mb3", force: :cascade do |t|
    t.bigint "arranged_at"
    t.bigint "arranged_next"
    t.integer "case_id"
    t.datetime "created_at", precision: nil, null: false
    t.string "information_need"
    t.text "notes"
    t.json "options"
    t.string "query_text", limit: 2048, collation: "utf8mb4_bin"
    t.datetime "updated_at", precision: nil, null: false
    t.index ["case_id"], name: "index_queries_on_case_id"
  end

  create_table "query_doc_pairs", charset: "utf8mb3", collation: "utf8mb3_unicode_ci", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.datetime "created_at", null: false
    t.string "doc_id", limit: 500
    t.text "document_fields", size: :medium, collation: "utf8mb4_0900_ai_ci"
    t.string "information_need"
    t.text "notes"
    t.json "options"
    t.integer "position"
    t.string "query_text", limit: 2048, collation: "utf8mb4_bin"
    t.datetime "updated_at", null: false
    t.index ["book_id"], name: "index_query_doc_pairs_on_book_id"
  end

  create_table "rails_pulse_deployments", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "revision", null: false, comment: "Git SHA, tag, or version string"
    t.datetime "started_at", null: false, comment: "When the deployment started"
    t.datetime "finished_at", comment: "When the deployment finished (nil if still in progress or unknown)"
    t.text "metadata", comment: "JSON object of arbitrary deployment metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["revision"], name: "index_rails_pulse_deployments_on_revision"
    t.index ["started_at"], name: "index_rails_pulse_deployments_on_started_at"
  end

  create_table "rails_pulse_exception_groups", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "fingerprint", null: false, comment: "SHA256 of exception_class + relative first app-code location"
    t.string "exception_class", null: false, comment: "e.g. ActiveRecord::RecordNotFound"
    t.string "location", comment: "Relative first app-code frame, e.g. app/models/user.rb#save"
    t.text "message", comment: "Message from the most recent occurrence"
    t.datetime "first_seen_at", null: false
    t.datetime "last_seen_at", null: false
    t.integer "occurrence_count", default: 0, null: false
    t.string "status", default: "open", null: false, comment: "open, resolved, ignored"
    t.datetime "resolved_at", comment: "When the group was last resolved"
    t.boolean "preserve", default: false, null: false, comment: "Exempt from all automatic cleanup including occurrence rows"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["exception_class"], name: "index_rp_exception_groups_on_class"
    t.index ["fingerprint"], name: "index_rp_exception_groups_on_fingerprint", unique: true
    t.index ["last_seen_at"], name: "index_rp_exception_groups_on_last_seen_at"
    t.index ["status"], name: "index_rp_exception_groups_on_status"
  end

  create_table "rails_pulse_exception_occurrences", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "exception_group_id", null: false, comment: "FK to the group this occurrence belongs to"
    t.string "exception_class", null: false
    t.text "message"
    t.text "backtrace", comment: "JSON array of {file, line, method} frames (first 50)"
    t.string "request_url", comment: "Nullable — web requests only"
    t.string "request_method", comment: "GET, POST, etc."
    t.string "environment", comment: "production, staging, etc."
    t.string "deploy_sha", comment: "Captured now even though Pro uses it — cannot backfill later"
    t.text "request_params", comment: "JSON hash of filtered request params — web requests only"
    t.datetime "occurred_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["exception_group_id"], name: "index_rp_exception_occurrences_on_group_id"
    t.index ["occurred_at"], name: "index_rp_exception_occurrences_on_occurred_at"
  end

  create_table "rails_pulse_job_runs", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "job_id", null: false, comment: "Link to job definition"
    t.string "run_id", null: false, comment: "Adapter specific run id"
    t.decimal "duration", precision: 15, scale: 6, comment: "Execution duration in milliseconds"
    t.string "status", null: false, comment: "Execution status"
    t.string "error_class", comment: "Error class name"
    t.text "error_message", comment: "Error message"
    t.integer "attempts", default: 0, null: false, comment: "Retry attempts"
    t.timestamp "occurred_at", null: false, comment: "When the job started"
    t.timestamp "enqueued_at", comment: "When the job was enqueued"
    t.text "arguments", comment: "Serialized arguments"
    t.string "adapter", comment: "Queue adapter"
    t.text "tags", comment: "Execution tags"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "occurred_at"], name: "index_rails_pulse_job_runs_on_job_and_occurred"
    t.index ["job_id", "status"], name: "index_rails_pulse_job_runs_on_job_and_status"
    t.index ["job_id"], name: "index_rails_pulse_job_runs_on_job_id"
    t.index ["occurred_at"], name: "index_rails_pulse_job_runs_on_occurred_at"
    t.index ["run_id"], name: "index_rails_pulse_job_runs_on_run_id", unique: true
    t.index ["status"], name: "index_rails_pulse_job_runs_on_status"
  end

  create_table "rails_pulse_jobs", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "name", null: false, comment: "Job class name"
    t.string "queue_name", comment: "Default queue"
    t.text "description", comment: "Optional description"
    t.integer "runs_count", default: 0, null: false, comment: "Cache of total runs"
    t.integer "failures_count", default: 0, null: false, comment: "Cache of failed runs"
    t.integer "retries_count", default: 0, null: false, comment: "Cache of retried runs"
    t.decimal "avg_duration", precision: 15, scale: 6, comment: "Average duration in milliseconds"
    t.decimal "p95_duration", precision: 15, scale: 6, comment: "95th percentile duration in milliseconds"
    t.decimal "p99_duration", precision: 15, scale: 6, comment: "99th percentile duration in milliseconds"
    t.text "tags", comment: "JSON array of tags"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_rails_pulse_jobs_on_name", unique: true
    t.index ["queue_name"], name: "index_rails_pulse_jobs_on_queue"
    t.index ["runs_count"], name: "index_rails_pulse_jobs_on_runs_count"
  end

  create_table "rails_pulse_operations", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "request_id", comment: "Link to the request"
    t.bigint "job_run_id", comment: "Link to a background job execution"
    t.bigint "query_id", comment: "Link to the normalized SQL query"
    t.string "operation_type", null: false, comment: "Type of operation (e.g., database, view, gem_call)"
    t.string "label", null: false, comment: "Display label: normalized SQL (≤255) for sql ops, controller#action / render path / cache key etc. for others"
    t.decimal "duration", precision: 15, scale: 6, null: false, comment: "Operation duration in milliseconds"
    t.string "codebase_location", comment: "File and line number (e.g., app/models/user.rb:25)"
    t.float "start_time", default: 0.0, null: false, comment: "Operation start time in milliseconds"
    t.timestamp "occurred_at", null: false, comment: "When the request started"
    t.integer "row_count", comment: "Number of rows returned (SQL operations, Rails 7.1+)"
    t.boolean "cache_hit", comment: "Whether a cache_read operation hit the cache"
    t.text "actual_sql", comment: "Actual SQL that ran for sql operations — comment-stripped, unparameterized, unbounded"
    t.text "repeated_query_group", comment: "Normalized SQL key identifying an N+1 group"
    t.integer "repetition_count", comment: "Number of times this query pattern repeated in the request"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at", "query_id"], name: "idx_operations_for_aggregation"
    t.index ["job_run_id"], name: "index_rails_pulse_operations_on_job_run_id"
    t.index ["occurred_at", "duration", "operation_type"], name: "index_rails_pulse_operations_on_time_duration_type"
    t.index ["operation_type"], name: "index_rails_pulse_operations_on_operation_type"
    t.index ["query_id", "duration", "occurred_at"], name: "index_rails_pulse_operations_query_performance"
    t.index ["query_id", "occurred_at"], name: "index_rails_pulse_operations_on_query_and_time"
    t.index ["request_id"], name: "index_rails_pulse_operations_on_request_id"
    t.check_constraint "(request_id IS NOT NULL) OR (job_run_id IS NOT NULL)", name: "rails_pulse_operations_request_or_job_run"
  end

  create_table "rails_pulse_queries", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "hashed_sql", limit: 32, null: false, comment: "MD5 hash of normalized SQL for fast lookups and uniqueness"
    t.text "normalized_sql", null: false, comment: "Full normalized SQL query string (e.g., SELECT * FROM users WHERE id = ?)"
    t.datetime "analyzed_at", comment: "When query analysis was last performed"
    t.text "explain_plan", comment: "EXPLAIN output from actual SQL execution"
    t.text "issues", comment: "JSON array of detected performance issues"
    t.text "metadata", comment: "JSON object containing query complexity metrics"
    t.text "query_stats", comment: "JSON object with query characteristics analysis"
    t.text "backtrace_analysis", comment: "JSON object with call chain and N+1 detection"
    t.text "index_recommendations", comment: "JSON array of database index recommendations"
    t.text "n_plus_one_analysis", comment: "JSON object with enhanced N+1 query detection results"
    t.text "suggestions", comment: "JSON array of optimization recommendations"
    t.text "tags", comment: "JSON array of tags for filtering and categorization"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hashed_sql"], name: "index_rails_pulse_queries_on_hashed_sql", unique: true
  end

  create_table "rails_pulse_requests", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.bigint "route_id", null: false, comment: "Link to the route"
    t.string "method", comment: "HTTP method used for this request (e.g., GET, POST)"
    t.decimal "duration", precision: 15, scale: 6, null: false, comment: "Total request duration in milliseconds"
    t.integer "status", null: false, comment: "HTTP status code (e.g., 200, 500)"
    t.boolean "is_error", default: false, null: false, comment: "True if status >= 500"
    t.string "request_uuid", null: false, comment: "Unique identifier for the request (e.g., UUID)"
    t.string "controller_action", comment: "Controller and action handling the request (e.g., PostsController#show)"
    t.timestamp "occurred_at", null: false, comment: "When the request started"
    t.text "tags", comment: "JSON array of tags for filtering and categorization"
    t.integer "response_size_bytes", comment: "HTTP response body size in bytes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at", "route_id"], name: "idx_requests_for_aggregation"
    t.index ["occurred_at"], name: "index_rails_pulse_requests_on_occurred_at"
    t.index ["request_uuid"], name: "index_rails_pulse_requests_on_request_uuid", unique: true
    t.index ["route_id", "occurred_at"], name: "index_rails_pulse_requests_on_route_id_and_occurred_at"
    t.index ["route_id"], name: "index_rails_pulse_requests_on_route_id"
  end

  create_table "rails_pulse_routes", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.text "http_methods", null: false, comment: "JSON array of HTTP methods accepted by this route (e.g., [\"GET\",\"POST\"])"
    t.string "path", null: false, comment: "Normalized request path (e.g., /posts/:id)"
    t.text "tags", comment: "JSON array of tags for filtering and categorization"
    t.string "controller_action", comment: "Rails controller and action handling this route (e.g., articles#show)"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "(case when (controller_action is null) then path else NULL end)", name: "index_rails_pulse_routes_on_path_without_action", unique: true
    t.index ["controller_action", "path"], name: "index_rails_pulse_routes_on_controller_action_and_path", unique: true
    t.index ["path"], name: "index_rails_pulse_routes_on_path"
  end

  create_table "rails_pulse_summaries", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "period_start", null: false, comment: "Start of the aggregation period"
    t.datetime "period_end", null: false, comment: "End of the aggregation period"
    t.string "period_type", null: false, comment: "Aggregation period type: hour, day, week, month"
    t.string "summarizable_type", null: false
    t.bigint "summarizable_id", null: false, comment: "Link to Route or Query"
    t.integer "count", default: 0, null: false, comment: "Total number of requests/operations"
    t.float "avg_duration", comment: "Average duration in milliseconds"
    t.float "min_duration", comment: "Minimum duration in milliseconds"
    t.float "max_duration", comment: "Maximum duration in milliseconds"
    t.float "p50_duration", comment: "50th percentile duration"
    t.float "p95_duration", comment: "95th percentile duration"
    t.float "p99_duration", comment: "99th percentile duration"
    t.float "total_duration", comment: "Total duration in milliseconds"
    t.float "stddev_duration", comment: "Standard deviation of duration"
    t.integer "error_count", default: 0, comment: "Number of error responses (5xx)"
    t.integer "success_count", default: 0, comment: "Number of successful responses"
    t.integer "status_2xx", default: 0, comment: "Number of 2xx responses"
    t.integer "status_3xx", default: 0, comment: "Number of 3xx responses"
    t.integer "status_4xx", default: 0, comment: "Number of 4xx responses"
    t.integer "status_5xx", default: 0, comment: "Number of 5xx responses"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_rails_pulse_summaries_on_created_at"
    t.index ["period_start"], name: "index_rails_pulse_summaries_on_period_start"
    t.index ["period_type", "period_start"], name: "index_rails_pulse_summaries_on_period"
    t.index ["summarizable_id"], name: "index_rails_pulse_summaries_on_summarizable_id"
    t.index ["summarizable_type", "summarizable_id", "period_type", "period_start"], name: "idx_pulse_summaries_unique", unique: true
    t.index ["summarizable_type", "summarizable_id"], name: "index_rails_pulse_summaries_on_summarizable"
  end

  create_table "ratings", id: :integer, charset: "latin1", force: :cascade do |t|
    t.datetime "created_at", precision: nil, null: false
    t.string "doc_id", limit: 500
    t.integer "query_id"
    t.float "rating"
    t.datetime "updated_at", precision: nil, null: false
    t.integer "user_id"
    t.index ["doc_id"], name: "index_ratings_on_doc_id", length: 191
    t.index ["query_id"], name: "index_ratings_on_query_id"
  end

  create_table "scorers", id: :integer, charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.text "code"
    t.boolean "communal", default: false
    t.datetime "created_at", precision: nil, null: false
    t.string "name"
    t.integer "owner_id"
    t.string "scale"
    t.text "scale_with_labels"
    t.boolean "show_scale_labels", default: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["owner_id"], name: "index_scorers_owner_id"
  end

  create_table "search_endpoints", charset: "utf8mb3", force: :cascade do |t|
    t.string "api_method"
    t.boolean "archived", default: false
    t.string "basic_auth_credential", limit: 4000
    t.datetime "created_at", null: false
    t.string "custom_headers", limit: 6000
    t.string "endpoint_url", limit: 500
    t.string "mapper_based_search_engine_id"
    t.text "mapper_code"
    t.string "name"
    t.json "options"
    t.integer "owner_id"
    t.boolean "proxy_requests", default: false
    t.integer "requests_per_minute", default: 0
    t.string "search_engine", limit: 50
    t.text "test_query"
    t.datetime "updated_at", null: false
    t.index ["owner_id", "id"], name: "index_search_endpoints_on_owner_id_and_id"
  end

  create_table "snapshot_docs", id: :integer, charset: "latin1", force: :cascade do |t|
    t.string "doc_id", limit: 500
    t.text "explain", size: :medium, collation: "utf8mb4_0900_ai_ci"
    t.text "fields", size: :medium, collation: "utf8mb4_0900_ai_ci"
    t.integer "position"
    t.boolean "rated_only", default: false
    t.integer "snapshot_query_id"
    t.index ["snapshot_query_id"], name: "snapshot_query_id"
  end

  create_table "snapshot_queries", id: :integer, charset: "latin1", force: :cascade do |t|
    t.boolean "all_rated"
    t.text "error"
    t.integer "number_of_results"
    t.integer "query_id"
    t.integer "response_status"
    t.float "score"
    t.integer "snapshot_id"
    t.index ["query_id"], name: "index_snapshot_queries_on_query_id"
    t.index ["snapshot_id"], name: "snapshot_id"
  end

  create_table "snapshots", id: :integer, charset: "latin1", force: :cascade do |t|
    t.integer "case_id"
    t.datetime "created_at", precision: nil
    t.string "name", limit: 250
    t.bigint "scorer_id"
    t.bigint "try_id"
    t.datetime "updated_at", precision: nil, null: false
    t.index ["case_id"], name: "index_snapshots_on_case_id"
    t.index ["scorer_id"], name: "index_snapshots_on_scorer_id"
    t.index ["try_id"], name: "index_snapshots_on_try_id"
  end

  create_table "solid_cable_messages", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.binary "channel", limit: 1024, null: false
    t.bigint "channel_hash", null: false
    t.datetime "created_at", null: false
    t.binary "payload", size: :long, null: false
    t.index ["channel"], name: "index_solid_cable_messages_on_channel"
    t.index ["channel_hash"], name: "index_solid_cable_messages_on_channel_hash"
    t.index ["created_at"], name: "index_solid_cable_messages_on_created_at"
  end

  create_table "solid_queue_blocked_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "teams", id: :integer, charset: "latin1", force: :cascade do |t|
    t.datetime "created_at", precision: nil, null: false
    t.string "name", collation: "utf8mb3_bin"
    t.datetime "updated_at", precision: nil, null: false
    t.index ["name"], name: "index_teams_on_name", length: 191
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
    t.string "ancestry", limit: 3072
    t.integer "case_id"
    t.datetime "created_at", precision: nil, null: false
    t.boolean "escape_query", default: true
    t.string "field_spec", limit: 500
    t.string "name", limit: 50
    t.integer "number_of_rows", default: 10
    t.string "query_params", limit: 20000
    t.bigint "search_endpoint_id"
    t.integer "try_number"
    t.datetime "updated_at", precision: nil, null: false
    t.index ["case_id"], name: "index_tries_on_case_id"
    t.index ["search_endpoint_id"], name: "index_tries_on_search_endpoint_id"
    t.index ["try_number"], name: "ix_queryparam_tryNo"
  end

  create_table "users", id: :integer, charset: "latin1", force: :cascade do |t|
    t.boolean "administrator", default: false
    t.boolean "agreed"
    t.datetime "agreed_time", precision: nil
    t.string "company"
    t.boolean "completed_case_wizard", default: false, null: false
    t.datetime "created_at", precision: nil, null: false
    t.integer "default_scorer_id"
    t.string "email", limit: 80
    t.boolean "email_marketing", default: false, null: false
    t.datetime "invitation_accepted_at", precision: nil
    t.datetime "invitation_created_at", precision: nil
    t.integer "invitation_limit"
    t.datetime "invitation_sent_at", precision: nil
    t.string "invitation_token"
    t.integer "invitations_count", default: 0
    t.integer "invited_by_id"
    t.string "llm_key", limit: 4000
    t.boolean "locked"
    t.datetime "locked_at", precision: nil
    t.string "name"
    t.integer "num_logins"
    t.json "options"
    t.integer "owner_id"
    t.string "password", limit: 120
    t.string "profile_pic", limit: 4000
    t.datetime "reset_password_sent_at", precision: nil
    t.string "reset_password_token"
    t.string "stored_raw_invitation_token"
    t.string "system_prompt", limit: 4000
    t.string "type"
    t.datetime "updated_at", precision: nil, null: false
    t.integer "escalates_to_id"
    t.index ["default_scorer_id"], name: "index_users_on_default_scorer_id"
    t.index ["email"], name: "ix_user_username", unique: true
    t.index ["escalates_to_id"], name: "index_users_on_escalates_to_id"
    t.index ["invitation_token"], name: "index_users_on_invitation_token", unique: true, length: 191
    t.index ["invited_by_id"], name: "index_users_on_invited_by_id"
    t.index ["name"], name: "index_users_on_name"
    t.index ["owner_id"], name: "index_users_owner_id"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true, length: 191
    t.index ["type"], name: "index_users_on_type"
  end

  create_table "web_requests", charset: "utf8mb4", collation: "utf8mb4_bin", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "integer"
    t.binary "request"
    t.binary "response", size: :long
    t.integer "response_status"
    t.integer "snapshot_query_id"
    t.datetime "updated_at", null: false
    t.index ["snapshot_query_id"], name: "index_web_requests_on_snapshot_query_id", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "annotations", "users"
  add_foreign_key "book_metadata", "books"
  add_foreign_key "books_ai_judges", "books"
  add_foreign_key "case_metadata", "cases", name: "case_metadata_ibfk_1"
  add_foreign_key "case_metadata", "users", name: "case_metadata_ibfk_2"
  add_foreign_key "case_scores", "annotations"
  add_foreign_key "case_scores", "cases", name: "case_scores_ibfk_1"
  add_foreign_key "case_scores", "users", name: "case_scores_ibfk_2"
  add_foreign_key "cases", "users", column: "owner_id", name: "cases_ibfk_1"
  add_foreign_key "judgements", "judgements", column: "escalated_from_judgement_id", on_delete: :nullify
  add_foreign_key "judgements", "query_doc_pairs"
  add_foreign_key "mapper_wizard_states", "users"
  add_foreign_key "queries", "cases", name: "queries_ibfk_1"
  add_foreign_key "query_doc_pairs", "books"
  add_foreign_key "rails_pulse_exception_occurrences", "rails_pulse_exception_groups", column: "exception_group_id"
  add_foreign_key "rails_pulse_job_runs", "rails_pulse_jobs", column: "job_id"
  add_foreign_key "rails_pulse_operations", "rails_pulse_job_runs", column: "job_run_id"
  add_foreign_key "rails_pulse_operations", "rails_pulse_queries", column: "query_id"
  add_foreign_key "rails_pulse_operations", "rails_pulse_requests", column: "request_id"
  add_foreign_key "rails_pulse_requests", "rails_pulse_routes", column: "route_id"
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
  add_foreign_key "teams_cases", "cases"
  add_foreign_key "teams_cases", "teams"
  add_foreign_key "teams_members", "teams"
  add_foreign_key "teams_members", "users", column: "member_id"
  add_foreign_key "teams_scorers", "scorers"
  add_foreign_key "teams_scorers", "teams"
  add_foreign_key "tries", "cases", name: "tries_ibfk_1"
  add_foreign_key "users", "scorers", column: "default_scorer_id"
  add_foreign_key "users", "users", column: "escalates_to_id", on_delete: :nullify
  add_foreign_key "users", "users", column: "invited_by_id"
  add_foreign_key "web_requests", "snapshot_queries"
end
