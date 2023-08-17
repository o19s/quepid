# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id             :bigint           not null, primary key
#  api_method     :string(255)
#  custom_headers :string(1000)
#  endpoint_url   :string(500)
#  name           :string(255)
#  search_engine  :string(50)
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  owner_id       :integer
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

  # Validations
  # validates :case_name, presence: true
  # validates_with ScorerExistsValidator
  #
  #
  def fullname
    middle_truncate "#{search_engine.capitalize} #{endpoint_url}"
  end

  private

  def middle_truncate str, total: 30, lead: 15, trail: 15
    str.truncate(total, omission: "#{str.first(lead)}...#{str.last(trail)}")
  end
end
