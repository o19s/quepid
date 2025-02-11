# frozen_string_literal: true

# == Schema Information
#
# Table name: scorers
#
#  id                :integer          not null, primary key
#  code              :text(65535)
#  communal          :boolean          default(FALSE)
#  name              :string(255)
#  scale             :string(255)
#  scale_with_labels :text(65535)
#  show_scale_labels :boolean          default(FALSE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  owner_id          :integer
#
# Indexes
#
#  index_scorers_owner_id  (owner_id)
#

require 'scale_serializer'

class Scorer < ApplicationRecord
  # Associations
  belongs_to :owner, class_name: 'User', optional: true # for communal scorers there isn't a owner

  # not sure about this!
  # has_many :users, dependent: :nullify

  has_many   :snapshots,
             dependent: :nullify

  has_many :scores, dependent: :nullify

  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_scorers'
  # rubocop:enable Rails/HasAndBelongsToMany

  # Validations
  validates_with ScaleValidator

  # Scopes
  scope :for_user, ->(user) do
    base_scope = left_joins(teams: [ :members, :scorers ])
    team_member = base_scope.where(teams_members: { member_id: user.id })
    owned_by_user = where(scorers: { owner_id: user.id })
    team_member.or(owned_by_user).or(communal).distinct
  end

  scope :communal, -> { where(communal: true) }

  # the default scorer for users who don't have one specified.
  def self.system_default_scorer
    find_by(name: Rails.application.config.quepid_default_scorer)
  end

  # Transform scale from array to a string
  serialize :scale, coder: ScaleSerializer
  serialize :scale_with_labels, coder: JSON

  after_initialize do |scorer|
    scorer.scale      = [] if scorer.scale.blank?

    # This is not always accurate since a scorer can be deleted and thus
    # we could presumably have two scorers with the same name.
    # But since we won't get an ID before saving the object, this is better
    # than nothing.
    # Ideally users would provide a meaningful name for scorers in order
    # to be able to identify them easily.
    scorer.name       = "Scorer #{Scorer.count + 1}" if scorer.name.blank?
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
end
