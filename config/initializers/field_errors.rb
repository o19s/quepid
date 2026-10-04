# frozen_string_literal: true

# Preserve Bootstrap floating-label siblings when Rails marks invalid fields.
ActionView::Base.field_error_proc = proc do |html_tag, _instance|
  fragment = Nokogiri::HTML::DocumentFragment.parse(html_tag)
  fragment.css('input, textarea, select').each do |field|
    field['class'] = [ field['class'], 'is-invalid' ].compact.join(' ')
    field['aria-invalid'] = 'true'
  end
  # Rails generated this escaped tag; only fixed classes/ARIA attributes were added.
  # rubocop:disable-next Rails/OutputSafety
  fragment.to_html.html_safe
end
