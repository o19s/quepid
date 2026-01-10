class AddTestQueryToSearchEndpoints < ActiveRecord::Migration[8.1]
  def change
    add_column :search_endpoints, :test_query, :text
  end
end
