class CreateModels < ActiveRecord::Migration[8.1]
  def change
    create_table :models do |t|
      t.string :model_id, null: false
      t.string :name, null: false
      t.string :provider, null: false
      t.string :family
      t.datetime :model_created_at
      t.integer :context_window
      t.integer :max_output_tokens
      t.date :knowledge_cutoff

      t.json :modalities
      t.json :capabilities
      t.json :pricing
      t.json :metadata

      t.timestamps

      t.index [ :provider, :model_id ], unique: true
      t.index :provider
      t.index :family
    end
  end
end
