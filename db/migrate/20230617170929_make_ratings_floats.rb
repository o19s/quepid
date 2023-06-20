class MakeRatingsFloats < ActiveRecord::Migration[7.0]
  def change
    change_column :ratings, :rating, :float
  end
end
