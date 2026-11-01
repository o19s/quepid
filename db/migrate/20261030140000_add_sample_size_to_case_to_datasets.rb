# frozen_string_literal: true

# How many queries a case was asked to load when it was made from only a sample of its dataset; nil when it
# got them all (and for cases made before this was recorded).
class AddSampleSizeToCaseToDatasets < ActiveRecord::Migration[8.1]
  def change
    add_column :case_to_datasets, :sample_size, :integer
  end
end
