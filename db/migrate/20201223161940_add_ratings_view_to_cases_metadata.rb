class AddRatingsViewToCasesMetadata < ActiveRecord::Migration[5.2]
  def change
    add_column :case_metadata, :ratings_view, :integer
  end
end
