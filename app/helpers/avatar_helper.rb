# frozen_string_literal: true

require 'digest/md5'
require 'uri'

module AvatarHelper
  # Font size as a percentage of the avatar size
  INITIALS_FONT_SIZE_RATIO = 0.42
  # SVG border radius
  SVG_BORDER_RADIUS = 6

  # Renders an avatar image for a user.
  # - uses `user.avatar_url(size)` when available (profile_pic or gravatar)
  # - otherwise generates a simple SVG data-uri containing initials
  # - if the user is an AI judge, badges the avatar with a robot icon
  #
  # @param user [User] the user object to render an avatar for
  # @param size [Symbol] the size key (:small, :medium, :big)
  # @param classes [String] additional CSS classes for the wrapper
  # @return [String] HTML-safe string containing the avatar image
  def avatar_tag user, size: :medium, classes: ''
    return content_tag(:div, '?', class: 'avatar-placeholder') if user.nil?

    size_px = avatar_size_in_pixels(size)
    wrapper_classes = "position-relative d-inline-block #{classes}".strip

    img = if user.respond_to?(:avatar_url) && user.avatar_url(size).present?
            render_avatar_image(user, size, size_px)
          else
            render_initials_avatar(user, size_px)
          end

    wrap_avatar(img, user, wrapper_classes)
  end

  private

  def avatar_size_in_pixels size
    Profile::SIZES[size] || Profile::SIZES[:medium]
  end

  def render_avatar_image user, size, size_px
    image_tag(
      user.avatar_url(size),
      alt:   user.fullname,
      class: 'rounded',
      style: "width:#{size_px}px;height:#{size_px}px;object-fit:cover;"
    )
  end

  def render_initials_avatar user, size_px
    initials = generate_initials(user)
    color = generate_color_from_email(user.email)
    svg = build_initials_svg(initials, color, size_px)
    data_uri = "data:image/svg+xml;utf8,#{ERB::Util.url_encode(svg)}"

    image_tag(
      data_uri,
      alt:   user.fullname,
      class: 'rounded',
      style: "width:#{size_px}px;height:#{size_px}px;object-fit:cover;"
    )
  end

  def generate_initials user
    # Use display_name for consistency with Profile concern
    display_text = user.respond_to?(:display_name) ? user.display_name : (user.name.presence || user.email.to_s)
    display_text.to_s.split.map(&:first).join.upcase[0, 2]
  end

  def generate_color_from_email email
    "##{Digest::MD5.hexdigest(email.to_s.downcase)[0..5]}"
  end

  def build_initials_svg initials, color, size_px
    font_size = (size_px * INITIALS_FONT_SIZE_RATIO).to_i

    <<~SVG
      <svg xmlns='http://www.w3.org/2000/svg' width='#{size_px}' height='#{size_px}' viewBox='0 0 #{size_px} #{size_px}'>
        <rect width='100%' height='100%' fill='#{color}' rx='#{SVG_BORDER_RADIUS}' />
        <text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='Arial, Helvetica, sans-serif' font-size='#{font_size}' fill='white'>#{ERB::Util.html_escape(initials)}</text>
      </svg>
    SVG
  end

  def wrap_avatar img, user, wrapper_classes
    content_tag(:div, class: wrapper_classes) do
      if user.ai_judge?
        img + ai_judge_badge
      else
        img
      end
    end
  end

  def ai_judge_badge
    content_tag(
      :span,
      content_tag(:i, '', class: 'bi bi-robot'),
      class:        'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-light text-dark border',
      style:        'font-size:0.65rem;',
      'aria-label': 'AI Judge'
    )
  end
end
