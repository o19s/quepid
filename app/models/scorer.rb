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
#  communal               :boolean
#

require 'scale_serializer'

class Scorer < ApplicationRecord
  # Associations
  belongs_to :owner, class_name: 'User', optional: true # for communal scorers there isn't a owner

  # not sure about this!
  # has_many :users, dependent: :nullify

  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_scorers'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :query, inverse_of: :test, optional: true # only applies to unit test style scorers.

  # Validations
  validates_with ScaleValidator

  # Scopes
  scope :for_user, ->(user) {
    joins('
      LEFT OUTER JOIN `teams_scorers` ON `teams_scorers`.`scorer_id` = `scorers`.`id`
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_scorers`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
    ').where('
      `teams`.`owner_id` = ?
      OR `teams_members`.`member_id` = ?
      OR `scorers`.`owner_id` = ?
      OR `scorers`.`communal` = true
    ', user.id, user.id, user.id)
  }

  scope :communal, -> { where(communal: true) }

  # the default scorer for users who don't have one specified.
  def self.system_default_scorer
    find_by(name: Rails.application.config.quepid_default_scorer)
  end

  # Transform scale from array to a string
  serialize :scale, ScaleSerializer
  serialize :scale_with_labels, JSON

  after_initialize do |scorer|
    scorer.scale      = []       if scorer.scale.blank?
    scorer.query_test = false    if scorer.query_test.blank?

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
