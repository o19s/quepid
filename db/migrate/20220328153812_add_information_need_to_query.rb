class AddInformationNeedToQuery < ActiveRecord::Migration[6.1]
  def change
    add_column :queries, :information_need, :string
  end
end
