class IncreaseCustomHeaderLength < ActiveRecord::Migration[7.1]
  def change
    change_column :search_endpoints, :custom_headers, :string, limit: 6000
  end
end
