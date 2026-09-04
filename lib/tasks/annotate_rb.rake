# frozen_string_literal: true

# This rake task was added by annotate_rb gem.

# Annotations are generated from the live connection, and db/schema.rb is
# authored against MySQL, so annotating from another adapter rewrites every
# model's schema comment to that adapter's idea of the types - PostgreSQL
# reports a varchar with no limit, so `:string(255)` becomes `:string` across
# 46 files. Same rule as dump_schema_after_migration in config/application.rb:
# only MySQL gets to regenerate what was authored against MySQL.
db_adapter = ENV.fetch('DB_ADAPTER', nil)
database_url = ENV.fetch('DATABASE_URL', '')
annotating_adapter = db_adapter.nil? || 'mysql2' == db_adapter
annotating_adapter &&= !database_url.start_with?('sqlite3:', 'postgres')

# Can set `ANNOTATERB_SKIP_ON_DB_TASKS` to be anything to skip this
if Rails.env.development? && ENV['ANNOTATERB_SKIP_ON_DB_TASKS'].nil? && annotating_adapter
  require 'annotate_rb'

  AnnotateRb::Core.load_rake_tasks
end
