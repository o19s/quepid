# frozen_string_literal: true

require 'test_helper'
require Rails.root.join('db/migrate/20261005192545_install_rails_pulse_tables')

class RailsPulseMigrationTest < ActiveSupport::TestCase
  class ScratchRecord < ApplicationRecord
    self.abstract_class = true
  end

  setup do
    ScratchRecord.establish_connection(adapter: 'sqlite3', database: ':memory:')
    connection = ScratchRecord.connection
    @migration = InstallRailsPulseTables.new
    @migration.define_singleton_method(:connection) { connection }
  end

  teardown do
    ScratchRecord.remove_connection
  end

  test 'installs all monitoring tables and tolerates a repeated install' do
    migrate :up
    tables = ScratchRecord.connection.tables.sort
    assert_equal 10, tables.length

    migrate :up
    assert_equal tables, ScratchRecord.connection.tables.sort
  end

  test 'repairs a partial install without replacing existing tables' do
    migrate :up
    connection = ScratchRecord.connection
    connection.execute(<<~SQL.squish)
      INSERT INTO rails_pulse_routes (http_methods, path, created_at, updated_at)
      VALUES ('["GET"]', '/pulse-migration-probe', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    SQL
    connection.drop_table(:rails_pulse_deployments)

    migrate :up

    assert connection.table_exists?(:rails_pulse_deployments)
    assert_equal 1, connection.select_value('SELECT COUNT(*) FROM rails_pulse_routes').to_i
  end

  test 'rollback removes all ten tables and allows replay' do
    migrate :up
    tables = ScratchRecord.connection.tables.sort

    migrate :down
    assert_empty ScratchRecord.connection.tables

    migrate :up
    assert_equal tables, ScratchRecord.connection.tables.sort
  end

  private

  def migrate direction
    capture_io { ActiveRecord::Migration.suppress_messages { @migration.public_send(direction) } }
  end
end
