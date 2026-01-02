class AddRequestsPerMinuteToSearchEndpoints < ActiveRecord::Migration[8.1]
  def change
    add_column :search_endpoints, :requests_per_minute, :integer, default: 0
  end
end
