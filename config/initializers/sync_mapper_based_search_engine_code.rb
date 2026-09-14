# frozen_string_literal: true

# See SearchEndpoint.sync_stale_mapper_based_search_engine_code! - keeps every preset-linked
# search endpoint's mapper_code copy fresh whenever its db/mapper_based_search_engines/*.js
# file has changed since the last sync, so updating a mapper (e.g. adding Vespa's
# ratedDocsQueryParamsMapper) reaches existing endpoints too, not just new ones.
#
# Runs after boot rather than during, and is wrapped defensively: the database may not exist
# yet (fresh install, `rails db:create`/`db:migrate` itself, asset precompile), and this is a
# nice-to-have sync, not something that should ever prevent the app from starting.
Rails.application.config.after_initialize do
  next if Rails.env.test?

  begin
    SearchEndpoint.sync_stale_mapper_based_search_engine_code! if ActiveRecord::Base.connection.table_exists?(:search_endpoints)
  rescue StandardError => e
    Rails.logger.warn("Skipping mapper-based search engine code sync at boot: #{e.message}")
  end
end
