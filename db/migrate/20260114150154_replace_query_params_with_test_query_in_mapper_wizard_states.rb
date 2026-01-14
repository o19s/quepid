class ReplaceQueryParamsWithTestQueryInMapperWizardStates < ActiveRecord::Migration[8.1]
  def change
    # Add test_query column (text type to match search_endpoints table)
    # This stores either query params for GET or JSON body for POST requests
    add_column :mapper_wizard_states, :test_query, :text

    # Remove unused query_params and request_body columns
    # These were never populated - the wizard uses test_query for both GET and POST
    remove_column :mapper_wizard_states, :query_params, :string
    remove_column :mapper_wizard_states, :request_body, :text
  end
end
