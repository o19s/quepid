class AddAdvancedOptions < ActiveRecord::Migration[7.0]
  def change
    add_column :search_endpoints, :proxy_requests, :boolean, default: false
    add_column :search_endpoints, :basic_auth_credential, :string, default: false
  end
end
