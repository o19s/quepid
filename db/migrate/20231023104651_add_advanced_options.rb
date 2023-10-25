class AddAdvancedOptions < ActiveRecord::Migration[7.0]
  def change
    add_column :search_endpoints, :basic_auth_credential, :string
  end
end
