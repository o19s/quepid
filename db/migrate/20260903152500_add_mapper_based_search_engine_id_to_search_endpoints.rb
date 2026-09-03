# frozen_string_literal: true

class AddMapperBasedSearchEngineIdToSearchEndpoints < ActiveRecord::Migration[8.1]
  def change
    add_column :search_endpoints, :mapper_based_search_engine_id, :string
  end
end
