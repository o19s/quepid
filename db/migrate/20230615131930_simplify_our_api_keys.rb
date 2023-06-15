class SimplifyOurApiKeys < ActiveRecord::Migration[7.0]
  def change
    create_table :api_keys do |t|
      t.integer :user_id
      t.string :token_digest
      t.timestamps
    end


    add_index :api_keys, :token_digest    
  end
end
