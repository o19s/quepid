class AddMapperCodeToSearchEndpoints < ActiveRecord::Migration[7.0]
  def change
    add_column :search_endpoints, :mapper_code, :text
  end
end
