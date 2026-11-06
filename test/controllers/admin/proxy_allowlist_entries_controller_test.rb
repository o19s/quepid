# frozen_string_literal: true

require 'test_helper'

module Admin
  class ProxyAllowlistEntriesControllerTest < ActionDispatch::IntegrationTest
    cover 'Admin::ProxyAllowlistEntriesController*'

    let(:admin) { users(:doug) }
    let(:other_admin) { users(:matt) }
    let(:entry) do
      ProxyAllowlistEntry.create!(kind: ProxyAllowlistEntry::NETWORK, value: '10.0.5.0/24', note: 'Prod Solr',
                                  created_by: admin, updated_by: admin)
    end

    # Runs every action once, asserting the block's expectation after each.
    def each_action
      { get:    [ admin_proxy_allowlist_entries_path, new_admin_proxy_allowlist_entry_path, edit_admin_proxy_allowlist_entry_path(entry) ],
        post:   [ admin_proxy_allowlist_entries_path ],
        patch:  [ admin_proxy_allowlist_entry_path(entry) ],
        delete: [ admin_proxy_allowlist_entry_path(entry) ] }.each do |verb, paths|
        paths.each do |path|
          send(verb, path, params: { proxy_allowlist_entry: { kind: 'network', value: '10.0.7.0/24' } })
          yield "#{verb} #{path}"
        end
      end
    end

    def capture_log
      io = StringIO.new
      logger = ActiveSupport::Logger.new(io)
      Rails.logger.broadcast_to(logger)
      yield
      io.string
    ensure
      Rails.logger.stop_broadcasting_to(logger)
    end

    test 'every action returns 404 when the flag is off' do
      login_user_for_integration_test admin

      with_proxy_allowlist_admin_managed(false) do
        each_action { |action| assert_response :not_found, action }
      end

      assert_equal [ '10.0.5.0/24' ], ProxyAllowlistEntry.pluck(:value)
    end

    test 'a non-administrator is redirected for every action' do
      login_user_for_integration_test users(:random)

      with_proxy_allowlist_admin_managed(true) do
        each_action do |action|
          assert_redirected_to root_path, action
          assert_equal 'You must be a Quepid Administrator.', flash[:alert], action
        end
      end

      assert_equal [ [ '10.0.5.0/24', 'Prod Solr' ] ], ProxyAllowlistEntry.pluck(:value, :note)
    end

    describe 'with the flag on' do
      setup do
        @original_admin_managed = Rails.application.config.proxy_allowlist_admin_managed
        Rails.application.config.proxy_allowlist_admin_managed = true
        login_user_for_integration_test admin
      end

      teardown do
        Rails.application.config.proxy_allowlist_admin_managed = @original_admin_managed
      end

      test 'index lists ENV entries read-only and stored entries with attribution' do
        entry
        with_proxy_allowed_networks('192.168.1.50') do
          with_proxy_allowed_hosts('env.internal') do
            get admin_proxy_allowlist_entries_path
          end
        end

        assert_response :success
        assert_select '#env-entries code', text: '192.168.1.50/32'
        assert_select '#env-entries code', text: 'env.internal'
        assert_select '#env-entries a, #env-entries form', count: 0
        assert_select "#managed-entries tr##{ActionView::RecordIdentifier.dom_id(entry)}" do
          assert_select 'code', text: '10.0.5.0/24'
          assert_select 'td', text: 'Prod Solr'
          assert_select 'td', text: /doug@example.com/
          assert_select 'a[href=?]', edit_admin_proxy_allowlist_entry_path(entry)
          assert_select 'form[data-turbo-confirm] button', text: 'Delete'
        end
      end

      test 'an admin creates a network and a host, attributed and logged' do
        log = capture_log do
          assert_difference 'ProxyAllowlistEntry.count', 2 do
            post admin_proxy_allowlist_entries_path, params: { proxy_allowlist_entry: { kind: 'network', value: '10.0.5.0/24', note: 'Prod Solr' } }
            assert_response :see_other
            assert_redirected_to admin_proxy_allowlist_entries_path

            post admin_proxy_allowlist_entries_path, params: { proxy_allowlist_entry: { kind: 'host', value: 'Search.Internal' } }
            assert_response :see_other
          end
        end

        network = ProxyAllowlistEntry.find_by!(kind: 'network')
        assert_equal [ '10.0.5.0/24', 'Prod Solr', admin, admin ], [ network.value, network.note, network.created_by, network.updated_by ]
        assert_equal 'search.internal', ProxyAllowlistEntry.find_by!(kind: 'host').value
        assert_includes log, "[proxy_allowlist] created network 10.0.5.0/24 by user #{admin.id} <doug@example.com>"
        assert_includes log, "[proxy_allowlist] created host search.internal by user #{admin.id} <doug@example.com>"
      end

      test 'an invalid create re-renders with 422 and the validation message' do
        assert_no_difference 'ProxyAllowlistEntry.count' do
          post admin_proxy_allowlist_entries_path, params: { proxy_allowlist_entry: { kind: 'network', value: '10.0.0.0/8' } }
        end

        assert_response :unprocessable_content
        assert_select '#error_explanation li', text: %r{/16}
      end

      test 'edit shows the kind read-only' do
        get edit_admin_proxy_allowlist_entry_path(entry)

        assert_response :success
        assert_select 'input#proxy_allowlist_entry_kind[readonly][value=network]'
        assert_select 'select#proxy_allowlist_entry_kind', count: 0
      end

      test 'another admin edits the value and note, ignoring a submitted kind, and the change is logged' do
        login_user_for_integration_test other_admin

        log = capture_log do
          patch admin_proxy_allowlist_entry_path(entry), params: { proxy_allowlist_entry: { kind: 'host', value: '10.0.6.0/24', note: 'Moved' } }
        end

        assert_response :see_other
        entry.reload
        assert_equal [ 'network', '10.0.6.0/24', 'Moved', admin, other_admin ], [ entry.kind, entry.value, entry.note, entry.created_by, entry.updated_by ]
        assert_includes log, "[proxy_allowlist] updated network 10.0.5.0/24 → 10.0.6.0/24 by user #{other_admin.id} <matt@example.com>"
      end

      test 'a note-only edit logs the unchanged value on both sides' do
        log = capture_log do
          patch admin_proxy_allowlist_entry_path(entry), params: { proxy_allowlist_entry: { note: 'Renamed' } }
        end

        assert_response :see_other
        assert_equal 'Renamed', entry.reload.note
        assert_includes log, '[proxy_allowlist] updated network 10.0.5.0/24 → 10.0.5.0/24 by user'
      end

      test 'an invalid edit re-renders with 422 and leaves the stored entry unchanged' do
        patch admin_proxy_allowlist_entry_path(entry), params: { proxy_allowlist_entry: { value: '10.0.0.0/8' } }

        assert_response :unprocessable_content
        assert_select '#error_explanation li', text: %r{/16}
        assert_equal '10.0.5.0/24', entry.reload.value
      end

      test 'destroy removes the entry and is logged' do
        entry
        log = capture_log do
          assert_difference 'ProxyAllowlistEntry.count', -1 do
            delete admin_proxy_allowlist_entry_path(entry)
          end
        end

        assert_response :see_other
        assert_redirected_to admin_proxy_allowlist_entries_path
        assert_includes log, "[proxy_allowlist] deleted network 10.0.5.0/24 by user #{admin.id} <doug@example.com>"
      end
    end

    test 'the admin sidebar links to the page only when the flag is on' do
      login_user_for_integration_test admin

      with_proxy_allowlist_admin_managed(true) do
        get admin_path
        assert_select '.admin-sidebar a[href=?]', admin_proxy_allowlist_entries_path, text: 'Proxy Allowlist'
      end

      with_proxy_allowlist_admin_managed(false) do
        get admin_path
        assert_select '.admin-sidebar a[href=?]', admin_proxy_allowlist_entries_path, count: 0
      end
    end
  end
end
