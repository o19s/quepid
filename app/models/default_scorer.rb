# frozen_string_literal: true

# == Schema Information
#
# Table name: default_scorers
#
#  id                     :integer          not null, primary key
#  code                   :text(65535)
#  name                   :string(255)
#  scale                  :string(255)
#  manual_max_score       :boolean          default(FALSE)
#  manual_max_score_value :integer
#  show_scale_labels      :boolean          default(FALSE)
#  scale_with_labels      :text(65535)
#  state                  :string(255)      default("draft")
#  published_at           :datetime
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#

require 'scale_serializer'

class DefaultScorer < ActiveRecord::Base
  # Associations
  # has_many :users, dependent: :nullify
  has_many :cases,
           as:         :scorer,
           dependent:  :nullify,
           inverse_of: :default_scorers

  # Validations
  validates_with ScaleValidator

  # Transform scale from array to a string
  serialize :scale, ScaleSerializer
  serialize :scale_with_labels, JSON

  # Scopes
  scope :published, -> {
    where(state: 'published')
      .where.not(published_at: nil)
  }

  # Callbacks
  before_create :set_published_at
  before_update :update_published_at

  def initialize attributes = nil, options = {}
    super

    self.scale      = []       if scale.blank?
    self.state      = 'draft'  if state.blank?
  end

  def scale_list=value
    self.scale = value.split(',') if value.present?
  end

  def scale_list
    # rubocop:disable Style/SafeNavigation
    scale.join(',') unless scale.nil?
    # scale&.join(',')
    # rubocop:enable Style/SafeNavigation
  end

  private

  def set_published_at
    self.published_at = Time.zone.now
  end

  def update_published_at
    self.published_at = Time.zone.now if state_changed? && ('published' == state)
  end
end
