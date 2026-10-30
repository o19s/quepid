# frozen_string_literal: true

# A case made from a dataset is created at once and filled in by a background job; the status says
# where that is (pending, loading, done, failed), and error why it failed.
class AddStatusToCaseToDatasets < ActiveRecord::Migration[8.1]
  def change
    add_column :case_to_datasets, :status, :string, null: false, default: 'pending', limit: 20
    add_column :case_to_datasets, :error, :text

    # Links made before there was a status were loaded in one go, so they are done.
    up_only { execute "UPDATE case_to_datasets SET status = 'done'" }
  end
end
