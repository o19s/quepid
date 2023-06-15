class SimplifyOurApiKeys < ActiveRecord::Migration[7.0]
  def change
    drop_table :api_keys

    create_table :api_keys do |t|
      t.integer :user_id
      t.string :token_digest, null: false 
      t.timestamps
    end


    add_index :api_keys, :token_digest #, unique: true    
  end
end
