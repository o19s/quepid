# frozen_string_literal: true

# Renders a single document card in the results pane. Uses MatchesComponent for
# the explain section when the document has explain data.
#
# Replaces inline HTML built by results_pane_controller.js. The rating badge uses
# id="rating-badge-<doc_id>" so Turbo Stream responses from the ratings API can
# update it in-place.
#
# @see ResultsPaneComponent
# @see MatchesComponent
# @see docs/view_component_conventions.md
class DocumentCardComponent < ApplicationComponent
  # @param doc [Hash] Document from search API: id, position, fields, explain (optional)
  # @param rating [String, nil] Current rating for this doc (empty for "Rate")
  # @param index [Integer] 0-based index for display position
  # @param diff_entries [Array<Hash>, nil] Optional diff info: [{ position:, name: }]
  # @param scale [Array<Integer>] Scorer scale for rating popover (e.g. [0,1,2,3])
  def initialize(doc:, rating: nil, index: 0, diff_entries: nil, scale: [ 0, 1, 2, 3 ])
    @doc          = doc
    @rating       = rating.to_s.presence || ""
    @index        = index
    @diff_entries = diff_entries
    @scale        = scale
  end

  def doc_id
    @doc[:id] || @doc["id"]
  end

  def position
    @doc[:position] || @doc["position"] || (@index + 1)
  end

  def fields
    @doc[:fields] || @doc["fields"] || {}
  end

  def explain_raw
    ex = @doc[:explain] || @doc["explain"]
    ex.is_a?(String) ? ex : ex&.to_json
  end

  def has_explain?
    explain_raw.present?
  end

  def doc_title
    return doc_id.to_s if fields.blank?

    title_field = fields["title"] || fields["name"] || fields["text"]
    return doc_id.to_s if title_field.blank?

    Array(title_field).first || doc_id.to_s
  end

  def fields_preview
    keys = fields.keys.reject { |k| %w[id _id title name].include?(k.to_s) }
    return "" if keys.empty?

    preview = keys.first(3).map do |k|
      v = fields[k]
      str = v.is_a?(Array) ? v.first : v.to_s
      str.to_s.length > 50 ? "#{str.to_s[0, 50]}…" : str.to_s
    end.join(" · ")
    preview.presence || ""
  end

  # Full fields as JSON for the detail modal (embedded as data attribute on the card).
  def fields_json
    fields.to_json
  end

  def rating_badge_id
    "rating-badge-#{doc_id.to_s.gsub(/\s/, '_')}"
  end

  def diff_entries
    @diff_entries || []
  end

  def diff_active?
    !@diff_entries.nil?
  end

  def diff_new?
    diff_active? && @diff_entries.empty?
  end

  def rating
    @rating
  end

  def explain_display_text
    raw = explain_raw
    return "No explain text available." if raw.blank?

    parsed = JSON.parse(raw)
    JSON.pretty_generate(parsed)
  rescue JSON::ParserError
    raw
  end
end
