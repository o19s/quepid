# frozen_string_literal: true

class AddTypeToUsers < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :type, :string
    add_index :users, :type

    # Backfill everyone explicitly - never leave `type` NULL. Rails treats a
    # NULL type as the base class by default, which would work today, but
    # relying on that means every future `where(type: 'User')` has to
    # remember to also match NULL. Stamping every row now avoids that trap.
    execute "UPDATE users SET type = 'AiJudge' WHERE llm_key IS NOT NULL"
    execute "UPDATE users SET type = 'User' WHERE llm_key IS NULL"
  end

  def down
    remove_column :users, :type
  end
end
