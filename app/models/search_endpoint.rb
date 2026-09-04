# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id                    :bigint           not null, primary key
#  api_method            :string(255)
#  archived              :boolean          default(FALSE)
#  basic_auth_credential :string(4000)
#  custom_headers        :string(6000)
#  endpoint_url          :string(500)
#  mapper_code           :text(65535)
#  name                  :string(255)
#  options               :json
#  proxy_requests        :boolean          default(FALSE)
#  requests_per_minute   :integer          default(0)
#  search_engine         :string(50)
#  test_query            :text(65535)
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

  # Serialization
  serialize :custom_headers, coder: JSON

  # Concerns
  include MaskableCredential

  # Scopes
  include ForUserScope

  # Encryption
  encrypts :basic_auth_credential, deterministic: false

  scope :not_archived, -> { where(archived: false) }

  after_initialize do |se|
    se.archived = false if se.archived.nil?
  end

  # Validations
  validates :search_engine, presence: true
  validates :endpoint_url, presence: true
  validates :api_method, presence: true
  validates :options, json_format: true, allow_blank: true
  validates :custom_headers, json_format: { normalize_values: true }, allow_blank: true
  validate :validate_proxy_requests_api_method
  validate :validate_proxy_required_for_hidden_credentials

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

  def cases_count
    Case.joins(:tries).where(tries: { search_endpoint_id: id }).distinct.count
  end

  # Find an existing endpoint owned by or shared with the user, or build a new one.
  # basic_auth_credential is excluded from the lookup because it is non-deterministically
  # encrypted and cannot be queried with find_by.
  # proxy_requests defaults to false when omitted so lookup matches the DB default; callers
  # that use a proxied endpoint must pass proxy_requests explicitly.
  def self.find_or_initialize_for_user user, params
    normalized = params.to_h.symbolize_keys
    normalized[:proxy_requests] = false if normalized[:proxy_requests].nil?

    lookup_keys = [ :search_engine, :endpoint_url, :api_method, :proxy_requests ]
    lookup_params = normalized.slice(*lookup_keys)

    if lookup_keys.all? { |key| lookup_params.key?(key) }
      # These four fields do not identify an endpoint uniquely - the same URL
      # can be registered more than once with different options or credentials.
      # find_by would take whichever row the database happened to return first,
      # which is not defined and does differ between adapters. Take the oldest
      # match instead, so the same import always attaches the same endpoint.
      endpoint = user.search_endpoints_involved_with.where(lookup_params).order(:id).first
      return endpoint if endpoint
    end

    endpoint = new(normalized)
    endpoint.owner = user
    endpoint
  end

  private

  def middle_truncate str, total: 30, lead: 15, trail: 15
    str.truncate(total, omission: "#{str.first(lead)}...#{str.last(trail)}")
  end

  def validate_proxy_requests_api_method
    errors.add(:api_method, 'cannot be JSONP when proxy_request is enabled') if proxy_requests? && 'JSONP' == api_method
  end

  def validate_proxy_required_for_hidden_credentials
    return unless Rails.application.config.require_proxy_with_basic_auth_credentials
    return if basic_auth_credential.blank?

    errors.add(:proxy_requests, 'must be enabled when basic auth credentials are present') unless proxy_requests?
  end
end
