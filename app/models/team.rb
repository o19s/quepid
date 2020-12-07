# frozen_string_literal: true

# == Schema Information
#
# Table name: teams
#
#  id         :integer          not null, primary key
#  name       :string(255)
#  owner_id   :integer          not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class Team < ApplicationRecord
  # Associations
  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :cases,
                          join_table: 'teams_cases'

  has_and_belongs_to_many :members,
                          class_name:              'User',
                          join_table:              'teams_members',
                          association_foreign_key: 'member_id',
                          uniq:                    true

  has_and_belongs_to_many :scorers,
                          join_table: 'teams_scorers'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :owner,
             class_name: 'User'

  # Validations
  # rubocop:disable Rails/UniqueValidationWithoutIndex
  validates :name,
            presence:   true,
            uniqueness: true
  # rubocop:enable Rails/UniqueValidationWithoutIndex

  # Scopes
  scope :for_user, ->(user) {
    joins('
      LEFT OUTER JOIN teams_members on teams_members.team_id = teams.id
      LEFT OUTER JOIN users on users.id = teams_members.member_id
    ').where('`teams`.`owner_id` = ? OR `teams_members`.`member_id` = ?', user.id, user.id)
  }
end
