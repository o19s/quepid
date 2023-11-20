class AddProxyToSearchEndpoints < ActiveRecord::Migration[7.0]
  def change
    add_column :search_endpoints, :proxy_requests, :boolean, default: false
  end
end
