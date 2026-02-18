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
  def initialize(doc:, rating: nil, index: 0, diff_entries: nil, scale: [ 0, 1, 2, 3 ], highlights: nil, image_prefix: nil)
    @doc          = doc
    @rating       = rating.to_s.presence || ""
    @index        = index
    @diff_entries = diff_entries
    @scale        = scale
    @highlights   = highlights || {}
    @image_prefix = image_prefix
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

  def highlights
    @highlights
  end

  def has_highlights?
    @highlights.present? && @highlights.any?
  end

  # Returns highlighted snippets for display. Allows only safe HTML tags.
  def highlighted_snippets
    return [] unless has_highlights?

    @highlights.flat_map do |_field, fragments|
      Array(fragments).first(2)
    end
  end

  # Detect an image URL from document fields by common naming patterns or URL extension.
  # When an image_prefix is configured (via JSON field spec), relative URLs are prefixed
  # to produce a full URL (e.g. "/images/photo.jpg" → "https://cdn.example.com/images/photo.jpg").
  def image_url
    return nil if fields.blank?

    image_keys = fields.keys.select do |k|
      k.to_s.match?(/image|img|thumb|photo|picture|poster|cover/i) ||
        Array(fields[k]).first.to_s.match?(/\.(jpe?g|png|gif|webp|svg)(\?|$)/i)
    end

    return nil if image_keys.empty?

    url = Array(fields[image_keys.first]).first.to_s
    return url if url.match?(%r{\Ahttps?://})

    if @image_prefix.present? && url.present?
      "#{@image_prefix.chomp('/')}#{url.start_with?('/') ? '' : '/'}#{url}"
    end
  end

  # Detect media URLs (audio, video, image) from document fields.
  # Returns an array of { type: "audio"|"video"|"image", url: "..." } hashes.
  def media_embeds
    return @media_embeds if defined?(@media_embeds)

    audio_ext = /\.(mp3|wav|ogg|flac|aac)(\?|$)/i
    video_ext = /\.(mp4|webm|avi|mov|mkv|ogv)(\?|$)/i
    image_ext = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)(\?|$)/i

    @media_embeds = []
    fields.each_value do |val|
      url = Array(val).first.to_s.strip
      next unless url.match?(%r{\Ahttps?://})
      next if @media_embeds.any? { |e| e[:url] == url }

      if url.match?(audio_ext)
        @media_embeds << { type: "audio", url: url }
      elsif url.match?(video_ext)
        @media_embeds << { type: "video", url: url }
      elsif url.match?(image_ext) && image_url != url
        @media_embeds << { type: "image", url: url }
      end
    end
    @media_embeds
  end

  def has_media_embeds?
    media_embeds.any?
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
