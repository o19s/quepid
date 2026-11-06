# frozen_string_literal: true

# == Schema Information
#
# Table name: proxy_allowlist_entries
#
#  id            :bigint           not null, primary key
#  kind          :string(255)      not null
#  note          :string(255)
#  value         :string(255)      not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  created_by_id :integer
#  updated_by_id :integer
#
# Indexes
#
#  index_proxy_allowlist_entries_on_created_by_id   (created_by_id)
#  index_proxy_allowlist_entries_on_kind_and_value  (kind,value) UNIQUE
#  index_proxy_allowlist_entries_on_updated_by_id   (updated_by_id)
#
# An admin-managed addition to the proxy allowlist (see ProxyAllowlist). Only read
# when PROXY_ALLOWLIST_ADMIN_MANAGED is on.
class ProxyAllowlistEntry < ApplicationRecord
  NETWORK = 'network'
  HOST = 'host'
  KINDS = [ NETWORK, HOST ].freeze

  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :updated_by, class_name: 'User', optional: true

  before_validation :normalize_value

  validates :kind, inclusion: { in: KINDS }
  validates :value, presence: true, length: { maximum: 253 }
  validates :value, uniqueness: { scope: :kind }, if: -> { @value_error.nil? }
  validates :note, length: { maximum: 255 }
  validate :value_within_limits

  def network?
    NETWORK == kind
  end

  def host?
    HOST == kind
  end

  private

  def normalize_value
    @value_error = nil
    return if value.blank?

    if network?
      normalize_network
    elsif host?
      host, error = ProxyAllowlist.parse_host(value)
      self.value = host if host
      @value_error = "is #{error}; put IPs and ranges in a network entry" if error
    end
  end

  def normalize_network
    network, error = ProxyAllowlist.parse_network(value.strip)
    return @value_error = "is not a valid CIDR range or IP (#{error})" if error

    network = ProxyAllowlist.native(network)
    self.value = "#{network}/#{network.prefix}"
    @value_error = ProxyAllowlist.admin_network_error(network)
  end

  def value_within_limits
    errors.add(:value, @value_error) if @value_error
  end
end
