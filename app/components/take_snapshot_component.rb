# frozen_string_literal: true

# Renders the "Take Snapshot" trigger and modal for capturing current case/try state.
# Replaces Angular TakeSnapshotCtrl and PromptSnapshotCtrl. Uses server-side snapshot
# creation (CreateSnapshotFromSearchJob) when docs are not available client-side.
#
# API: POST api/cases/:case_id/snapshots with { snapshot: { name, record_document_fields?, try_number? } }
class TakeSnapshotComponent < ApplicationComponent
  # Engines that support doc lookup by ID (can optionally skip recording document fields).
  SUPPORT_LOOKUP_BY_ID = %w[solr es os].freeze

  # @param case_id [Integer] Case id
  # @param try_number [Integer, nil] Current try number (for API)
  # @param search_engine [String] e.g. "solr", "es", "os", "static"
  # @param field_spec [String, nil] Displayed fields (e.g. "id,title,description")
  # @param can_take_snapshot [Boolean] Whether snapshot is allowed (requires non-static search endpoint)
  # @param button_label [String, nil] Optional label for Angular parity (e.g. "Create Snapshot")
  def initialize case_id:, try_number: nil, search_engine: 'solr', field_spec: nil, can_take_snapshot: true, button_label: nil
    @case_id = case_id
    @try_number = try_number
    @search_engine = search_engine.to_s
    @field_spec = field_spec
    @can_take_snapshot = can_take_snapshot
    @button_label = button_label
  end

  def support_lookup_by_id?
    SUPPORT_LOOKUP_BY_ID.include?(@search_engine.downcase)
  end

  def field_spec_display
    @field_spec.presence || 'id, title, and other displayed fields'
  end

  def search_engine_display
    case @search_engine.downcase
    when 'solr' then 'Solr'
    when 'es' then 'Elasticsearch'
    when 'os' then 'OpenSearch'
    when 'static' then 'Static'
    else @search_engine
    end
  end
end
