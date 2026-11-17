# frozen_string_literal: true

require 'test_helper'

class ProxyAllowlistTest < ActiveSupport::TestCase
  cover 'ProxyAllowlist*'

  describe 'parse_network' do
    test 'accepts a CIDR range' do
      assert_equal [ IPAddr.new('10.0.5.0/24'), nil ], ProxyAllowlist.parse_network('10.0.5.0/24')
      network, _error = ProxyAllowlist.parse_network('10.0.5.0/24')
      assert_equal IPAddr.new('10.0.5.0/24'), network
      assert_equal 24, network.prefix
    end

    test 'accepts a single IP' do
      network, error = ProxyAllowlist.parse_network('192.168.1.50')
      assert_nil error
      assert_equal IPAddr.new('192.168.1.50'), network
      assert_equal 32, network.prefix
    end

    test 'rejects an invalid prefix with the IPAddr error' do
      network, error = ProxyAllowlist.parse_network('10.0.0.0/99')
      assert_nil network
      assert_equal 'invalid length', error
    end
  end

  describe 'parse_host' do
    test 'accepts a plain hostname' do
      assert_equal [ 'search.internal', nil ], ProxyAllowlist.parse_host('search.internal')
    end

    test 'normalizes case, whitespace and a trailing dot' do
      assert_equal [ 'search.internal', nil ], ProxyAllowlist.parse_host(' SEARCH.Internal. ')
    end

    test 'rejects a wildcard' do
      assert_equal [ nil, ProxyAllowlist::HOST_ERROR ], ProxyAllowlist.parse_host('*.internal')
    end

    test 'rejects a scheme' do
      assert_equal [ nil, ProxyAllowlist::HOST_ERROR ], ProxyAllowlist.parse_host('http://x')
    end

    test 'rejects a bare IP' do
      assert_equal [ nil, ProxyAllowlist::HOST_ERROR ], ProxyAllowlist.parse_host('10.1.2.3')
    end
  end

  describe 'admin_network_error' do
    test 'accepts ranges at the breadth limits' do
      assert_nil ProxyAllowlist.admin_network_error(IPAddr.new('10.20.0.0/16'))
      assert_nil ProxyAllowlist.admin_network_error(IPAddr.new('fd00::/48'))
    end

    test 'rejects ranges broader than the limits, naming the limit, family and workaround' do
      assert_equal 'is broader than /16; admin-managed IPv4 entries are limited to /16 or narrower ' \
                   '(add several narrower entries to cover a wider range)',
                   ProxyAllowlist.admin_network_error(IPAddr.new('10.0.0.0/15'))
      assert_equal 'is broader than /48; admin-managed IPv6 entries are limited to /48 or narrower ' \
                   '(add several narrower entries to cover a wider range)',
                   ProxyAllowlist.admin_network_error(IPAddr.new('fd00::/47'))
    end

    test 'overlap is detected whichever range is wider' do
      wide = IPAddr.new('10.0.0.0/8')
      narrow = IPAddr.new('10.1.0.0/16')
      assert ProxyAllowlist.send(:overlap?, wide, narrow)
      assert ProxyAllowlist.send(:overlap?, narrow, wide)
      assert_not ProxyAllowlist.send(:overlap?, narrow, IPAddr.new('10.2.0.0/16'))
    end

    test 'rejects ranges overlapping loopback, unspecified or link-local, in either direction' do
      %w[127.0.0.1 127.1.0.0/16 0.0.0.0 0.0.0.0/16 :: 169.254.169.254 169.254.0.0/16 ::1 fe80::1 fe80::/64 ::ffff:169.254.169.254].each do |value|
        assert_equal ProxyAllowlist::ADMIN_FORBIDDEN_ERROR,
                     ProxyAllowlist.admin_network_error(IPAddr.new(value)), value
      end
    end

    test 'accepts a range next to a forbidden one' do
      assert_nil ProxyAllowlist.admin_network_error(IPAddr.new('126.255.0.0/16'))
      assert_nil ProxyAllowlist.admin_network_error(IPAddr.new('169.255.0.0/16'))
      assert_nil ProxyAllowlist.admin_network_error(IPAddr.new('1.0.0.0/16'))
    end
  end

  describe 'native' do
    test 'unwraps an IPv4-mapped IPv6 address and leaves other addresses alone' do
      assert_equal IPAddr.new('10.0.5.20'), ProxyAllowlist.native(IPAddr.new('::ffff:10.0.5.20'))
      assert_predicate ProxyAllowlist.native(IPAddr.new('::ffff:10.0.5.20')), :ipv4?
      assert_predicate ProxyAllowlist.native(IPAddr.new('::10.0.5.20')), :ipv6?
      assert_predicate ProxyAllowlist.native(IPAddr.new('10.0.5.20')), :ipv4?
    end
  end

  describe 'blocked?' do
    def allowlist admin_managed: false
      config = ActiveSupport::OrderedOptions.new
      config.proxy_allowlist_admin_managed = admin_managed
      ProxyAllowlist.new(config: config)
    end

    def blocked? list, ip, hostname: 'search.internal'
      list.blocked?(IPAddr.new(ip), hostname: hostname)
    end

    def store kind, value
      now = Time.current
      ProxyAllowlistEntry.insert_all!([ { kind: kind, value: value, created_at: now, updated_at: now } ])
    end

    test 'blocks loopback, unspecified, private and link-local addresses and allows public ones' do
      list = allowlist
      %w[127.0.0.1 ::1 0.0.0.0 :: 10.0.5.20 100.64.0.1 172.16.5.5 192.168.1.1 fc00::1 169.254.169.254 fe80::1 ::ffff:127.0.0.1 ::ffff:10.0.5.20].each do |ip|
        assert blocked?(list, ip), "expected #{ip} to be blocked"
      end
      %w[8.8.8.8 2001:4860:4860::8888].each do |ip|
        assert_not blocked?(list, ip), "expected #{ip} to be allowed"
      end
    end

    test 'stored entries are ignored, without a query, when the flag is off' do
      store(ProxyAllowlistEntry::NETWORK, '10.0.5.0/24')
      list = allowlist(admin_managed: false)
      assert_no_queries { assert blocked?(list, '10.0.5.20') }
    end

    test 'stored networks allow addresses inside them, including stored IPv4-mapped ranges' do
      store(ProxyAllowlistEntry::NETWORK, '10.0.5.0/24')
      store(ProxyAllowlistEntry::NETWORK, '::ffff:10.0.7.0/120')
      list = allowlist(admin_managed: true)
      assert_not blocked?(list, '10.0.5.20')
      assert_not blocked?(list, '10.0.7.20')
      assert blocked?(list, '10.0.6.20')
      assert_not blocked?(list, '8.8.8.8')
    end

    test 'stored hosts allow private addresses for that name only, never loopback or unspecified' do
      store(ProxyAllowlistEntry::HOST, 'search.internal')
      list = allowlist(admin_managed: true)
      assert_not blocked?(list, '10.1.2.3', hostname: 'Search.Internal.')
      assert blocked?(list, '10.1.2.3', hostname: 'other.internal')
      %w[127.0.0.1 ::1 0.0.0.0 :: 169.254.169.254].each do |ip|
        assert blocked?(list, ip), "expected #{ip} to be blocked"
      end
    end

    test 'a stored row is only used as its own kind' do
      store(ProxyAllowlistEntry::HOST, '10.0.5.0/24')
      store(ProxyAllowlistEntry::NETWORK, 'search.internal')
      list = allowlist(admin_managed: true)
      assert blocked?(list, '10.0.5.20', hostname: 'solr.internal')
      assert blocked?(list, '10.1.2.3', hostname: 'search.internal')
    end

    test 'stored entries are loaded once per allowlist' do
      store(ProxyAllowlistEntry::NETWORK, '10.0.5.0/24')
      store(ProxyAllowlistEntry::HOST, 'search.internal')
      list = allowlist(admin_managed: true)
      assert_queries_count(1) do
        blocked?(list, '10.0.6.20', hostname: 'a.internal')
        blocked?(list, '10.0.6.21', hostname: 'b.internal')
      end
    end

    test 'defaults to the application config' do
      store(ProxyAllowlistEntry::NETWORK, '10.0.5.0/24')

      with_proxy_allowlist_admin_managed(true) do
        assert_not ProxyAllowlist.new.blocked?(IPAddr.new('10.0.5.20'), hostname: 'x')
      end
    end
  end

  describe 'test helper' do
    test 'with_proxy_allowlist_admin_managed restores the original value' do
      original = Rails.application.config.proxy_allowlist_admin_managed

      with_proxy_allowlist_admin_managed(!original) do
        assert_equal !original, Rails.application.config.proxy_allowlist_admin_managed
      end

      assert_equal original, Rails.application.config.proxy_allowlist_admin_managed
    end
  end
end
