# frozen_string_literal: true

require 'ipaddr'

# Decides which internal addresses the proxy may reach, and validates allowlist
# entries. The ENV lists (PROXY_ALLOWED_NETWORKS / PROXY_ALLOWED_HOSTS, parsed at
# boot in config/initializers/customize_quepid.rb) are the authoritative baseline.
# When PROXY_ALLOWLIST_ADMIN_MANAGED is on, ProxyAllowlistEntry rows add to them,
# within the hard limits below.
class ProxyAllowlist
  HOSTNAME_FORMAT = /\A[a-z0-9_-]+(\.[a-z0-9_-]+)*\z/
  HOST_ERROR = 'not a plain hostname (no wildcards, schemes, ports or paths)'

  # Admin-managed networks may be no broader than these prefixes.
  MIN_ADMIN_IPV4_PREFIX = 16
  MIN_ADMIN_IPV6_PREFIX = 48

  # The unspecified addresses connect to localhost on Linux, so admin-managed
  # entries treat them as loopback.
  UNSPECIFIED_NETWORKS = [
    IPAddr.new('0.0.0.0/8'),
    IPAddr.new('::/128')
  ].freeze

  # Admin-managed networks may never overlap loopback, unspecified or link-local addresses.
  ADMIN_FORBIDDEN_NETWORKS = [
    IPAddr.new('127.0.0.0/8'),
    IPAddr.new('::1/128'),
    *UNSPECIFIED_NETWORKS,
    IPAddr.new('169.254.0.0/16'),
    IPAddr.new('fe80::/10')
  ].freeze
  ADMIN_FORBIDDEN_ERROR = 'must not include loopback (including 0.0.0.0) or link-local addresses'

  PRIVATE_RANGES = [
    IPAddr.new('0.0.0.0/8'), # "this host": 0.0.0.0 connects to localhost on Linux
    IPAddr.new('10.0.0.0/8'),
    IPAddr.new('100.64.0.0/10'), # carrier-grade NAT, commonly used for internal networks
    IPAddr.new('172.16.0.0/12'),
    IPAddr.new('192.168.0.0/16'),
    IPAddr.new('::/128'),
    IPAddr.new('fc00::/7')
  ].freeze

  class << self
    # Returns [IPAddr, nil] for a valid CIDR range or single IP, or [nil, error message].
    def parse_network string
      [ IPAddr.new(string), nil ]
    rescue IPAddr::Error => e
      [ nil, e.message ]
    end

    def normalize_host string
      string.strip.downcase.chomp('.')
    end

    # Returns [normalized hostname, nil] for a plain hostname, or [nil, error message].
    def parse_host string
      host = normalize_host(string)
      return [ host, nil ] if host.match?(HOSTNAME_FORMAT) && !host.match?(/\A[\d.]+\z/)

      [ nil, HOST_ERROR ]
    end

    # Returns an error message when an admin-managed network breaks the hard limits, else nil.
    def admin_network_error network
      network = native(network)
      min_prefix = network.ipv4? ? MIN_ADMIN_IPV4_PREFIX : MIN_ADMIN_IPV6_PREFIX
      if network.prefix < min_prefix
        return "is broader than /#{min_prefix}; admin-managed #{network.ipv4? ? 'IPv4' : 'IPv6'} entries are limited to /#{min_prefix} or narrower (use PROXY_ALLOWED_NETWORKS for wider ranges)"
      end

      ADMIN_FORBIDDEN_ERROR if ADMIN_FORBIDDEN_NETWORKS.any? { |forbidden| overlap?(network, forbidden) }
    end

    # An IPv4-mapped IPv6 address (::ffff:a.b.c.d) is judged by the IPv4 address it wraps.
    def native address
      address.ipv4_mapped? ? address.native : address
    end

    private

    def overlap? first, second
      first.include?(second.to_range.first) || second.include?(first.to_range.first)
    end
  end

  def initialize config: Rails.application.config
    @config = config
  end

  def blocked? address, hostname:
    address = self.class.native(address)
    hostname = self.class.normalize_host(hostname)

    # Operators can open specific internal networks with PROXY_ALLOWED_NETWORKS.
    return false if @config.proxy_allowed_networks.any? { |network| network.include?(address) }

    return true if address.link_local?
    # A PROXY_ALLOWED_HOSTS name may reach private addresses, but never link-local ones.
    return false if @config.proxy_allowed_hosts.include?(hostname)

    if @config.proxy_allowlist_admin_managed
      verdict = stored_entry_verdict(address, hostname)
      return verdict unless verdict.nil?
    end

    address.loopback? || PRIVATE_RANGES.any? { |range| range.include?(address) }
  end

  private

  # true (blocked) or false (allowed) when admin-managed entries decide, else nil.
  def stored_entry_verdict address, hostname
    # Admin-managed entries never reach loopback, including the unspecified addresses.
    return true if address.loopback? || UNSPECIFIED_NETWORKS.any? { |network| network.include?(address) }

    false if stored_networks.any? { |network| network.include?(address) } || stored_hosts.include?(hostname)
  end

  def stored_entries
    @stored_entries ||= ProxyAllowlistEntry.pluck(:kind, :value)
  end

  def stored_networks
    @stored_networks ||= stored_entries.filter_map do |kind, value|
      next unless ProxyAllowlistEntry::NETWORK == kind

      network, _error = self.class.parse_network(value)
      network && self.class.native(network)
    end
  end

  def stored_hosts
    @stored_hosts ||= stored_entries.filter_map { |kind, value| value if ProxyAllowlistEntry::HOST == kind }.to_set
  end
end
