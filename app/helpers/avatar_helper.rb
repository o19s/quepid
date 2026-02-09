# frozen_string_literal: true

require 'digest/md5'
require 'uri'

module AvatarHelper
  # Renders an avatar image for a user.
  # - uses `user.avatar_url(size)` when available (profile_pic or gravatar)
  # - otherwise generates a simple SVG data-uri containing initials
  # - if the user is an AI judge, badges the avatar with a robot icon
  def avatar_tag user, size: :medium, classes: ''
    size_px = if defined?(Profile::SIZES)
                Profile::SIZES[size] || 48
              else
                48
              end

    wrapper_classes = "position-relative d-inline-block #{classes}".strip

    if user.respond_to?(:avatar_url) && user.avatar_url(size).present?
      img = image_tag(user.avatar_url(size), alt: user.fullname, class: 'rounded', style: "width:#{size_px}px;height:#{size_px}px;object-fit:cover;")
    else
      # generate initials SVG
      initials = (user.name.presence || user.email.to_s).to_s.split.map(&:first).join.upcase[0, 2]
      color = '#' + Digest::MD5.hexdigest(user.email.to_s.downcase || '')[0..5]
      font_size = (size_px * 0.42).to_i

      svg = <<~SVG
        <svg xmlns='http://www.w3.org/2000/svg' width='#{size_px}' height='#{size_px}' viewBox='0 0 #{size_px} #{size_px}'>
          <rect width='100%' height='100%' fill='#{color}' rx='6' />
          <text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='Arial, Helvetica, sans-serif' font-size='#{font_size}' fill='white'>#{ERB::Util.html_escape(initials)}</text>
        </svg>
      SVG

      data = "data:image/svg+xml;utf8,#{ERB::Util.url_encode(svg)}"
      img = image_tag(data, alt: user.fullname, class: 'rounded', style: "width:#{size_px}px;height:#{size_px}px;object-fit:cover;")
    end

    # If AI judge, add a small robot badge overlay
    if user.ai_judge?
      content_tag(:div, class: wrapper_classes) do
        img + content_tag(:span, raw('<i class="bi bi-robot"></i>'), class: 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-light text-dark border', style: 'font-size:0.65rem;')
      end
    elsif wrapper_classes.present?
      # Non-AI users: wrap image to preserve spacing if classes were passed
      content_tag(:div, class: wrapper_classes) { img }
    else
      img
    end
  end
end
