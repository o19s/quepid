# frozen_string_literal: true

# Helper methods for rendering markdown content
module MarkdownHelper
  # Renders markdown text as HTML
  # @param text [String] The markdown text to render
  # @return [String] HTML-safe rendered markdown
  # rubocop:disable Metrics/MethodLength
  def render_markdown text
    return '' if text.blank?

    renderer = Redcarpet::Render::HTML.new(
      hard_wrap:       true,
      link_attributes: { target: '_blank', rel: 'noopener noreferrer' }
    )

    markdown = Redcarpet::Markdown.new(
      renderer,
      autolink:            true,
      tables:              true,
      fenced_code_blocks:  true,
      strikethrough:       true,
      superscript:         true,
      underline:           true,
      highlight:           true,
      no_intra_emphasis:   true,
      space_after_headers: true
    )

    # Sanitize and return as HTML-safe
    sanitize(markdown.render(text), tags: allowed_markdown_tags, attributes: allowed_markdown_attributes)
  end
  # rubocop:enable Metrics/MethodLength

  private

  def allowed_markdown_tags
    %w[
      p br h1 h2 h3 h4 h5 h6 hr
      strong em b i u s del mark sup sub
      ul ol li
      a
      table thead tbody tr th td
      blockquote pre code
      img
    ]
  end

  def allowed_markdown_attributes
    %w[href target rel src alt class title]
  end
end
