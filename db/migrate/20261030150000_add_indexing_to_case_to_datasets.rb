# frozen_string_literal: true

# A dataset case's documents are indexed into a search engine by a background job after the index is created: which
# index, how far it got, and why it stopped, if it did.
class AddIndexingToCaseToDatasets < ActiveRecord::Migration[8.1]
  def change
    change_table :case_to_datasets, bulk: true do |t|
      t.string  :index_name
      t.string  :indexing_status, limit: 20
      t.integer :documents_indexed
      t.text    :indexing_error
    end
  end
end
