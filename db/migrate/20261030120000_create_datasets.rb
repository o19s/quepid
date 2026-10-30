# frozen_string_literal: true

# What a user has made in Quepid from one of the example datasets (see DatasetCatalog::ENTRIES):
# the scorer built for its labels, the search endpoint it is hosted in, and the cases loaded from it.
class CreateDatasets < ActiveRecord::Migration[8.1]
  def change
    create_table :datasets do |t|
      t.string  :key, null: false, limit: 50
      t.integer :owner_id, null: false
      t.integer :scorer_id
      t.bigint  :search_endpoint_id
      t.timestamps
    end
    add_index :datasets, [ :owner_id, :key ], unique: true

    create_table :case_to_datasets do |t|
      t.integer :case_id, null: false
      t.bigint  :dataset_id, null: false
      t.timestamps
    end
    add_index :case_to_datasets, :case_id, unique: true
    add_index :case_to_datasets, :dataset_id
  end
end
