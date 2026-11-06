# frozen_string_literal: true

class SimplifyConnectionAccess < ActiveRecord::Migration[8.1]
  def up
    ownerless = select_value('SELECT COUNT(*) FROM connections WHERE owner_id IS NULL').to_i
    administrator_id = select_value("SELECT id FROM users WHERE administrator = #{connection.quoted_true} AND (type IS NULL OR type IN ('User', '')) ORDER BY id LIMIT 1")
    raise ActiveRecord::MigrationError, 'Assign a human administrator before migrating ownerless connections.' if ownerless.positive? && administrator_id.nil?

    add_column :connections, :instance_wide, :boolean, null: false, default: false
    execute "UPDATE connections SET owner_id = #{connection.quote(administrator_id)}, instance_wide = #{connection.quoted_true} WHERE owner_id IS NULL" if ownerless.positive?
    change_column_null :connections, :owner_id, false
    drop_table :teams_connections
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Removed connection team grants cannot be restored. Restore a backup to recover them.'
  end
end
