class AddOptionsToSearchEndpoints < ActiveRecord::Migration[7.0]
  def change
    add_column :search_endpoints, :options, :json
  end
end
