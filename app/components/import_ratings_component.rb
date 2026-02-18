# frozen_string_literal: true

# Renders the "Import" trigger and modal for importing ratings (CSV, RRE, LTR) and
# information needs (CSV). Works with the import_ratings Stimulus controller.
# Replaces the Angular importRatings component. Snapshots import tab deferred.
#
# API: POST case/:id/import/ratings (file_format=hash|csv|rre|ltr, clear_queries, ratings|rre_json|ltr_text)
#       csv maps to hash (client parses CSV and sends ratings)
#      POST api/import/queries/information_needs (case_id, csv_text, create_queries)
#
# @see docs/view_component_conventions.md
class ImportRatingsComponent < ApplicationComponent
  # @param case_id [Integer] Case to import into
  # @param case_name [String] Display name for modal title
  # @param icon_only [Boolean] If true, render only icon; otherwise icon + "Import" text
  def initialize(case_id:, case_name:, icon_only: true)
    @case_id   = case_id
    @case_name = case_name
    @icon_only = icon_only
  end
end
