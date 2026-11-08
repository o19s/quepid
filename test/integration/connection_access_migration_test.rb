# frozen_string_literal: true

require 'test_helper'
require Rails.root.join('db/migrate/20261105150000_simplify_connection_access')

class ConnectionAccessMigrationTest < ActiveSupport::TestCase
  class ScratchRecord < ApplicationRecord
    self.abstract_class = true
  end

  setup do
    ScratchRecord.establish_connection(adapter: 'sqlite3', database: ':memory:')
    @connection = ScratchRecord.connection
    @connection.create_table(:users) do |t|
      t.string :type
      t.boolean :administrator
    end
    @connection.create_table(:connections) do |t|
      t.integer :owner_id
      t.string :secret
    end
    @connection.create_table(:teams_connections) do |t|
      t.integer :connection_id
      t.integer :team_id
    end
    connection = @connection
    @migration = SimplifyConnectionAccess.new
    @migration.define_singleton_method(:connection) { connection }
  end

  teardown do
    ScratchRecord.remove_connection
  end

  test 'ownerless connections retain availability with a responsible human administrator' do
    @connection.execute("INSERT INTO users (id, type, administrator) VALUES (1, 'AiJudge', 1), (2, 'User', 1), (3, NULL, 0)")
    @connection.execute("INSERT INTO connections (id, owner_id, secret) VALUES (1, NULL, 'ciphertext-a'), (2, 3, 'ciphertext-b')")

    migrate

    rows = @connection.select_all('SELECT owner_id, instance_wide, secret FROM connections ORDER BY id').to_a
    assert_equal [ 2, 3 ], rows.pluck('owner_id')
    assert_equal [ 1, 0 ], rows.pluck('instance_wide')
    assert_equal %w[ciphertext-a ciphertext-b], rows.pluck('secret')
    assert_not @connection.table_exists?(:teams_connections)
    assert_not @connection.columns(:connections).find { |column| 'owner_id' == column.name }.null
  end

  test 'missing administrator aborts before schema or data changes when an owner is needed' do
    @connection.execute("INSERT INTO users (id, type, administrator) VALUES (1, 'AiJudge', 1)")
    @connection.execute('INSERT INTO connections (id, owner_id) VALUES (1, NULL)')

    assert_raises(ActiveRecord::MigrationError) { migrate }

    assert_not @connection.column_exists?(:connections, :instance_wide)
    assert @connection.table_exists?(:teams_connections)
    assert_nil @connection.select_value('SELECT owner_id FROM connections')
  end

  test 'owned connections remain private without requiring an administrator' do
    @connection.execute('INSERT INTO users (id, administrator) VALUES (3, 0)')
    @connection.execute('INSERT INTO connections (id, owner_id) VALUES (1, 3)')

    migrate

    assert_equal 3, @connection.select_value('SELECT owner_id FROM connections')
    assert_equal 0, @connection.select_value('SELECT instance_wide FROM connections')
  end

  private

  def migrate
    capture_io { ActiveRecord::Migration.suppress_messages { @migration.up } }
  end
end
