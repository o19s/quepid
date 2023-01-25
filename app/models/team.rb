# frozen_string_literal: true

# == Schema Information
#
# Table name: teams
#
#  id         :integer          not null, primary key
#  name       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  owner_id   :integer          not null
#
# Indexes
#
#  index_teams_on_name  (name)
#  owner_id             (owner_id)
#
# Foreign Keys
#
#  teams_ibfk_1  (owner_id => users.id)
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

  has_many   :books, -> { order(name: :asc) },
             dependent:  :destroy,
             inverse_of: :team

  # Every owner is also a member of the team.  So when we care about access to a team,
  # we only need to check the team.members or the case.team.members.
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
    ').where('`teams_members`.`member_id` = ?', user.id)
  }
end
