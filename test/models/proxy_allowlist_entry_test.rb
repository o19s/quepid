# frozen_string_literal: true

require 'test_helper'

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
class ProxyAllowlistEntryTest < ActiveSupport::TestCase
  cover 'ProxyAllowlistEntry*'

  def network value
    ProxyAllowlistEntry.new(kind: ProxyAllowlistEntry::NETWORK, value: value)
  end

  def host value
    ProxyAllowlistEntry.new(kind: ProxyAllowlistEntry::HOST, value: value)
  end

  test 'saves an IPv4 network at the /16 limit, normalized' do
    entry = network(' 10.20.1.0/16 ')
    assert_predicate entry, :save
    assert_equal '10.20.0.0/16', entry.value
  end

  test 'saves a single IP as a /32' do
    entry = network('10.0.5.20')
    assert entry.save
    assert_equal '10.0.5.20/32', entry.value
  end

  test 'rejects an IPv4 network broader than /16' do
    entry = network('10.0.0.0/8')
    assert_not entry.save
    assert_match %r{/16}, entry.errors[:value].first
  end

  test 'saves an IPv6 network at the /48 limit and rejects a broader one' do
    assert network('fd00::/48').save
    entry = network('fd00::/32')
    assert_not entry.save
    assert_match %r{/48}, entry.errors[:value].first
  end

  test 'rejects loopback, unspecified and link-local networks, including IPv4-mapped IPv6' do
    %w[127.0.0.1 0.0.0.0/16 169.254.169.254 ::ffff:169.254.169.254].each do |value|
      entry = network(value)
      assert_not entry.save, value
      assert_includes entry.errors[:value], ProxyAllowlist::ADMIN_FORBIDDEN_ERROR
    end
  end

  test 'stores an IPv4-mapped IPv6 network as IPv4' do
    entry = network('::ffff:10.0.5.20')
    assert entry.save
    assert_equal '10.0.5.20/32', entry.value
  end

  test 'rejects an invalid network' do
    entry = network('10.0.0.0/99')
    assert_not entry.save
    assert_match(/not a valid CIDR range or IP/, entry.errors[:value].first)
  end

  test 'saves a normalized host and rejects a wildcard' do
    entry = host('SEARCH.Internal.')
    assert entry.save
    assert_equal 'search.internal', entry.value

    wildcard = host('*.internal')
    assert_not wildcard.save
    assert_match(/not a plain hostname/, wildcard.errors[:value].first)
  end

  test 'rejects an unknown kind and a blank value' do
    entry = ProxyAllowlistEntry.new(kind: 'other', value: '')
    assert_not entry.save
    assert_predicate entry.errors[:kind], :present?
    assert_equal [ "can't be blank" ], entry.errors[:value]
    assert_equal [ "can't be blank" ], network('').tap(&:validate).errors[:value]
  end

  test 'does not parse the value of an unknown kind' do
    entry = ProxyAllowlistEntry.new(kind: 'other', value: '*.internal')
    entry.validate
    assert_empty entry.errors[:value]
  end

  test 'a corrected value clears the earlier validation error' do
    entry = host('*.internal')
    assert_not entry.valid?
    entry.value = 'search.internal'
    assert_predicate entry, :valid?
  end

  test 'rejects a duplicate, comparing normalized values' do
    network('10.0.5.0/24').save!
    duplicate = network('10.0.5.7/24')
    assert_not duplicate.save
    assert_includes duplicate.errors[:value], 'has already been taken'
  end

  test 'rejects a host over 253 characters instead of failing at the database' do
    entry = host("#{'a' * 250}.internal")
    assert_not entry.save
    assert_predicate entry.errors[:value], :present?
  end

  test 'rejects a note over 255 characters' do
    entry = network('10.0.5.0/24')
    entry.note = 'x' * 256
    assert_not entry.save
    assert_predicate entry.errors[:note], :present?
  end

  test 'updating a saved entry to a too-broad range is rejected and the stored value is unchanged' do
    entry = network('10.0.5.0/24')
    entry.save!

    assert_not entry.update(value: '10.0.0.0/8')
    assert_equal '10.0.5.0/24', entry.reload.value
  end

  test 'deleting the creator or the last updater nullifies the reference' do
    creator = User.create!(email: 'allowlist-creator@example.com', password: 'password', agreed: true)
    updater = User.create!(email: 'allowlist-updater@example.com', password: 'password', agreed: true)
    entry = network('10.0.5.0/24')
    entry.update!(created_by: creator, updated_by: updater)

    creator.destroy!
    assert_nil entry.reload.created_by_id
    assert_equal updater.id, entry.updated_by_id

    updater.destroy!
    assert_nil entry.reload.updated_by_id
  end

  test 'network? and host? reflect the kind' do
    assert_predicate network('10.0.5.0/24'), :network?
    assert_not_predicate network('10.0.5.0/24'), :host?
    assert_predicate host('search.internal'), :host?
    assert_not_predicate host('search.internal'), :network?
  end
end
