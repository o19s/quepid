class AddHeaderConfigToTry < ActiveRecord::Migration[6.1]
  def change
    add_column :tries, :custom_headers, :string, limit: 1000
  end
end
