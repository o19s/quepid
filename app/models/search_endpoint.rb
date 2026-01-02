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
#  requests_per_minute   :integer          default(0)
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

  after_initialize do |se|
    se.archived = false if se.archived.nil?
  end

  # Validations
  validates :search_engine, presence: true
  validates :endpoint_url, presence: true
  validates :api_method, presence: true
  validate :validate_proxy_requests_api_method

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

  # Virtual attribute for rate limiting (stored in options JSON)
  def requests_per_minute
    opts = parsed_options
    opts['requestsPerMinute']
  end

  def requests_per_minute= value
    # Only modify options if a value is explicitly provided
    # Blank/nil means "don't change" (user didn't touch the field)
    return if value.blank?

    opts = parsed_options
    if value.to_i.positive?
      opts['requestsPerMinute'] = value.to_i
    else
      # Value is 0, so remove the rate limit
      opts.delete('requestsPerMinute')
    end
    self.options = opts
  end

  # Helper to parse options whether it's a String or Hash
  def parsed_options
    return {} if options.blank?

    if options.is_a? String
      begin
        JSON.parse(options)
      rescue JSON::ParserError
        {}
      end
    else
      options.to_hash
    end
  end

  private

  def middle_truncate str, total: 30, lead: 15, trail: 15
    str.truncate(total, omission: "#{str.first(lead)}...#{str.last(trail)}")
  end

  def validate_proxy_requests_api_method
    errors.add(:api_method, 'cannot be JSONP when proxy_request is enabled') if proxy_requests? && 'JSONP' == api_method
  end
end
