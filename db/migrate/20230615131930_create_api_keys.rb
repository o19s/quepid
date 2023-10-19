class CreateApiKeys < ActiveRecord::Migration[7.0]
  def change
    # had to add a check as it may be in some envs that the table is already there!
    # oops!
    unless table_exists?(:api_keys)
      create_table :api_keys do |t|
        t.integer :user_id
        t.string :token_digest
        t.timestamps
      end
      add_index :api_keys, :token_digest   
    end
  end
end
