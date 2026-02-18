# frozen_string_literal: true

# Renders a side-by-side multi-column comparison between the current search
# results and one or more snapshots. Each column shows documents by position
# with color coding for rank changes (improved, degraded, new, missing).
#
# @see docs/view_component_conventions.md
class DiffComparisonComponent < ApplicationComponent
  # @param current_docs [Array<Hash>] Current live search results
  # @param snapshot_columns [Array<Hash>] Each: { name: String, docs: Array<Hash> }
  #   where docs have :doc_id, :position, and optionally :fields
  # @param ratings_map [Hash] doc_id(String) => rating
  # @param scorer_scale [Array<Integer>] e.g. [0,1,2,3]
  def initialize(current_docs:, snapshot_columns:, ratings_map: {}, scorer_scale: nil)
    @current_docs     = current_docs || []
    @snapshot_columns = snapshot_columns || []
    @ratings_map      = ratings_map || {}
    @scorer_scale     = scorer_scale || [ 0, 1, 2, 3 ]
  end

  # Build a lookup of { doc_id => position } for the current results
  def current_position_map
    @current_position_map ||= @current_docs.each_with_index.to_h { |doc, idx| [ doc_id(doc), idx + 1 ] }
  end

  # Get a status class for a snapshot doc relative to current results
  def diff_status(snapshot_doc, current_pos_map)
    sid = snapshot_doc[:doc_id].to_s
    current_pos = current_pos_map[sid]
    snap_pos = snapshot_doc[:position].to_i

    if current_pos.nil?
      "diff-doc--missing" # was in snapshot but not in current
    elsif current_pos < snap_pos
      "diff-doc--improved" # moved up (lower position = better)
    elsif current_pos > snap_pos
      "diff-doc--degraded" # moved down
    else
      "" # same position
    end
  end

  # Get status for a current doc relative to snapshot columns
  def current_doc_status(doc, snapshot_columns)
    did = doc_id(doc)
    in_any_snapshot = snapshot_columns.any? { |col| col[:doc_ids_set]&.include?(did) }
    in_any_snapshot ? "" : "diff-doc--new"
  end

  def doc_id(doc)
    (doc.is_a?(Hash) ? (doc[:id] || doc["id"]) : doc.id).to_s
  end

  def position_change_title(snap_doc, status)
    cur_pos = current_position_map[snap_doc[:doc_id].to_s]
    snap_pos = snap_doc[:position]
    case status
    when "diff-doc--improved" then "Now at ##{cur_pos} (was ##{snap_pos})"
    when "diff-doc--degraded" then "Now at ##{cur_pos} (was ##{snap_pos})"
    when "diff-doc--missing" then "Not in current results"
    else ""
    end
  end

  def doc_title(doc)
    return doc[:title] || doc[:name] || doc_id(doc) if doc.is_a?(Hash)

    doc_id(doc)
  end

  def rating_for(doc)
    @ratings_map[doc_id(doc).to_s]&.to_s || ""
  end

  # Pre-compute doc_ids_set for each snapshot column for O(1) lookups
  def prepared_snapshot_columns
    @prepared_snapshot_columns ||= @snapshot_columns.map do |col|
      docs = col[:docs] || []
      col.merge(doc_ids_set: docs.map { |d| d[:doc_id].to_s }.to_set)
    end
  end
end
