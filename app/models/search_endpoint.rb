# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id                    :bigint           not null, primary key
#  api_method            :string(255)
#  archived              :boolean          default(FALSE)
#  basic_auth_credential :string(255)      default("0")
#  custom_headers        :string(1000)
#  endpoint_url          :string(500)
#  name                  :string(255)
#  proxy_requests        :boolean          default(FALSE)
#  search_engine         :string(50)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  owner_id              :integer
#

class SearchEndpoint < ApplicationRecord
  # Associations
  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_search_endpoints'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :owner,
             class_name: 'User', optional: true

  has_many   :tries, dependent: :nullify, inverse_of: :search_endpoint

  # Scopes
  scope :not_archived, -> { where('`search_endpoints`.`archived` = false') }

  # rubocop:disable Layout/LineLength
  scope :for_user_via_teams, ->(user) {
    joins('
      LEFT OUTER JOIN `teams_search_endpoints` ON `teams_search_endpoints`.`search_endpoint_id` = `search_endpoints`.`id`
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_search_endpoints`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
    ').where('
        `teams_members`.`member_id` = ?
    ', user.id)
  }
  # rubocop:enable Layout/LineLength

  scope :for_user_directly_owned, ->(user) {
    joins('
      LEFT OUTER JOIN `tries` ON `tries`.`search_endpoint_id` = `search_endpoints`.`id`
      LEFT OUTER JOIN `cases` ON `cases`.`id` = `tries`.`case_id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `cases`.`owner_id`
    ').where('
        `users`.`id` = ?
    ',  user.id)
  }

  scope :for_user, ->(user) {
    ids = for_user_via_teams(user).distinct.pluck(:id) + for_user_directly_owned(user).distinct.pluck(:id)
    where(id: ids.uniq)
  }

  after_initialize do |se|
    se.archived = false if se.archived.nil?
  end

  # Validations
  # validates :case_name, presence: true
  # validates_with ScorerExistsValidator
  #
  #
  def fullname
    (name.presence || middle_truncate("#{search_engine.capitalize} #{endpoint_url}"))
  end

  def mark_archived
    self.archived = true
  end

  def mark_archived!
    mark_archived
    save
  end

  private

  def middle_truncate str, total: 30, lead: 15, trail: 15
    str.truncate(total, omission: "#{str.first(lead)}...#{str.last(trail)}")
  end
end
