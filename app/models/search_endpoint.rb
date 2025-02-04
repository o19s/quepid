# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id                    :bigint           not null, primary key
#  api_method            :string(255)
#  archived              :boolean          default(FALSE)
#  basic_auth_credential :string(255)
#  custom_headers        :string(6000)
#  endpoint_url          :string(500)
#  mapper_code           :text(65535)
#  name                  :string(255)
#  options               :json
#  proxy_requests        :boolean          default(FALSE)
#  search_engine         :string(50)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  owner_id              :integer
#
# Indexes
#
#  index_search_endpoints_on_owner_id_and_id  (owner_id,id)
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
  include ForUserScope

  scope :not_archived, -> { where('`search_endpoints`.`archived` = false') }

  validate :basic_auth_credential_has_valid_characters

  after_initialize do |se|
    se.archived = false if se.archived.nil?
  end

  # Validations
  # validates :case_name, presence: true
  # validates_with ScorerExistsValidator
  #
  #
  def fullname
    name.presence || middle_truncate("#{search_engine.titleize} #{endpoint_url}")
  end

  def mark_archived
    self.archived = true
  end

  def mark_archived!
    mark_archived
    save
  end

  def proxy_request?
    endpoint_url.include?('/proxy/fetch')
  end

  private

  def middle_truncate str, total: 30, lead: 15, trail: 15
    str.truncate(total, omission: "#{str.first(lead)}...#{str.last(trail)}")
  end

  def basic_auth_credential_has_valid_characters
    return if basic_auth_credential.blank?

    invalid_chars = basic_auth_credential.scan(%r{[\s<>"#%{}|\\^~\[\]`&+?=/;@]})
    if invalid_chars.any?
      errors.add(:basic_auth_credential,
                 "contains invalid characters: #{invalid_chars.uniq.join(', ')}")
    end
  end
end
