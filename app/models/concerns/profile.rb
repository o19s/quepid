# frozen_string_literal: true

require 'digest/md5'

module Profile
  extend ActiveSupport::Concern

  SIZES = {
    small:  24,
    medium: 48,
    big:    96,
  }.freeze

  def avatar_url size = :small
    if profile_pic.present?
      profile_pic
    elsif email
      gravatar_id   = Digest::MD5.hexdigest(email.downcase)
      gravatar_size = size_to_number size
      "https://secure.gravatar.com/avatar/#{gravatar_id}.png?s=#{gravatar_size}&d=retro"
    end
  end

  def display_name
    name.presence || email
  end

  private

  def size_to_number size
    SIZES[size]
  end
end
