# frozen_string_literal: true

# Renders the document score explanation (matches) panel for a search result.
# Replaces the Angular matches + debug_matches directives; expand uses ExpandContentComponent.
#
# Shows a compact explain string, a "Debug" button that opens a modal with the
# full raw explain JSON, and an "Expand" button (via ExpandContentComponent) for
# a full-screen view of the explain text.
#
# @see docs/view_component_conventions.md
class MatchesComponent < ApplicationComponent
  # @param doc_id [String] Document id for display and modal labeling
  # @param doc_title [String, nil] Document title for the modal header
  # @param doc_score [Numeric, nil] Relevancy score returned by the search engine
  # @param explain_text [String, nil] Human-readable explain string (explain().toStr())
  # @param explain_raw [String, nil] Raw explain JSON string (explain().rawStr()) for the debug modal
  # @param max_doc_score [Numeric, nil] Maximum document score in the result set
  # @param compact [Boolean] When true, show only Debug/Expand buttons (no inline explain pre)
  def initialize(doc_id:, doc_title: nil, doc_score: nil, explain_text: nil, explain_raw: nil, max_doc_score: nil, compact: false)
    @doc_id        = doc_id
    @doc_title     = doc_title
    @doc_score     = doc_score
    @explain_text  = explain_text
    @explain_raw   = explain_raw
    @max_doc_score = max_doc_score
    @compact       = compact
  end

  def compact?
    @compact
  end

  def modal_id
    "matchesDebugModal-#{sanitized_doc_id}"
  end

  def expand_modal_id
    "matchesExpandModal-#{sanitized_doc_id}"
  end

  def modal_title
    "Debug Explain for #{@doc_title.presence || @doc_id} (id:#{@doc_id})"
  end

  def expand_title
    "Relevancy Score: #{@doc_score}"
  end

  # Safe text for display and for ExpandContentComponent; avoids nil/blank body.
  def explain_text_display
    @explain_text.presence || "No explain text available."
  end

  private

  # Sanitize doc_id for use in HTML id attributes — replace non-alphanumeric
  # characters with hyphens to avoid breaking querySelector-based modal targeting.
  def sanitized_doc_id
    @doc_id.to_s.gsub(/[^a-zA-Z0-9_-]/, "-")
  end
end
