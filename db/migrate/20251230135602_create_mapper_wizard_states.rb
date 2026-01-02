class CreateMapperWizardStates < ActiveRecord::Migration[8.1]
  def change
    create_table :mapper_wizard_states do |t|
      t.integer :user_id
      t.string :search_url, limit: 2000
      t.string :http_method, limit: 10, default: 'GET'
      t.text :request_body, limit: 65_535
      t.text :html_content, limit: 16_777_215 # mediumtext for large HTML responses
      t.text :number_of_results_mapper, limit: 65_535
      t.text :docs_mapper, limit: 65_535

      t.timestamps
    end

    add_index :mapper_wizard_states, :user_id
    add_index :mapper_wizard_states, :created_at
    add_foreign_key :mapper_wizard_states, :users
  end
end
