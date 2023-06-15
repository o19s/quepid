class CreateApiKeys < ActiveRecord::Migration[7.0]
  def change
    create_table :api_keys do |t|
      t.integer :bearer_id
      t.string :bearer_type
      t.string :token
      t.timestamps
    end


    add_index :api_keys, [:bearer_id, :bearer_type]
    add_index :api_keys, :token #, unique: true
  end
end
