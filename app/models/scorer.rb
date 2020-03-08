# frozen_string_literal: true

# == Schema Information
#
# Table name: scorers
#
#  id                     :integer          not null, primary key
#  code                   :text(65535)
#  name                   :string(191)
#  owner_id               :integer
#  scale                  :string(255)
#  query_test             :boolean
#  query_id               :integer
#  manual_max_score       :boolean          default(FALSE)
#  manual_max_score_value :integer          default(100)
#  show_scale_labels      :boolean          default(FALSE)
#  scale_with_labels      :text(65535)
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  communal               :boolean          default(FALSE)
#

require 'scale_serializer'

class Scorer < ActiveRecord::Base
  # Constants
  DEFAULTS = {
    scale:      (1..10).to_a,
    code:       [
      '// Gets the average score over a scale of 100',
      '// (assumes query rating on a scale of 1-10)',
      'var score = avgRating100(10);',
      'if (score !== null) {',
      '  // Adds a distance penalty to the score',
      '  score -= editDistanceFromBest(10);',
      '}',
      'setScore(score);'
    ].join("\n"),
    query_test: false,
  }.freeze

  # Associations
  belongs_to :owner, class_name: 'User'

  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_scorers'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :query, inverse_of: :test

  # Validations
  validates_with ScaleValidator

  # Scopes
  scope :for_user, ->(user) {
    where.any_of(
      teams:         {
        owner_id: user.id,
      },
      teams_members: {
        member_id: user.id,
      },
      scorers:       {
        owner_id: user.id,
      }
    )
  }

  #
  # Communal as in for the community
  # didn't want to use 'public' because that is a special keyword
  # and shared in our context means that it was shared with a team
  scope :communal, -> {
    where(communal: true)
  }

  # Transform scale from array to a string
  serialize :scale, ScaleSerializer
  serialize :scale_with_labels, JSON

  def initialize attributes = nil, options = {}
    super

    self.code     ||= DEFAULTS[:code]
    self.scale      = DEFAULTS[:scale]      if scale.blank?
    self.query_test = DEFAULTS[:query_test] if query_test.blank?

    # This is not always accurate since a scorer can be deleted and thus
    # we could presumably have two scorers with the same name.
    # But since we won't get an ID before saving the object, this is better
    # than nothing.
    # Ideally users would provide a meaningful name for scorers in order
    # to be able to identify them easily.
    self.name       = "Scorer #{Scorer.count + 1}" if name.blank?
  end
end
