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
#  default                :boolean          default(FALSE)
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#

require 'scale_serializer'

module Legacy
  class QuepidScorer < ActiveRecord::Base
    # Constants
    DEFAULTS = {
      scale: (1..10).to_a,
      code:  [
        '// Gets the average score over a scale of 100',
        '// (assumes query rating on a scale of 1-10)',
        'var score = avgRating100(10);',
        'if (score !== null) {',
        '  // Adds a distance penalty to the score',
        '  score -= editDistanceFromBest(10);',
        '}',
        'setScore(score);'
      ].join("\n"),
      name:  'New Quepid Scorer',
      state: 'draft',
    }.freeze

    # Associations
    has_many :users, dependent: :nullify

    has_many :cases,
             as:         :scorer,
             dependent:  :nullify,
             inverse_of: :quepid_scorer

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

    scope :default, -> {
      where(default: true)
    }

    scope :non_default, -> {
      where(default: false)
    }

    # Callbacks
    before_create :set_published_at
    before_update :update_published_at

    def initialize attributes = nil, options = {}
      super

      self.code     ||= DEFAULTS[:code]
      self.scale      = DEFAULTS[:scale]  if scale.blank?
      self.name       = DEFAULTS[:name]   if name.blank?
      self.state      = DEFAULTS[:state]  if state.blank?
    end

    def scale_list=value
      self.scale = value.split(',') if value.present?
    end

    def scale_list
      scale.join(',')
    end

    private

    def set_published_at
      self.published_at = Time.zone.now
    end

    def update_published_at
      self.published_at = Time.zone.now if state_changed? && ('published' == state)
    end
  end
end
