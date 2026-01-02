class AddQueryParamsToMapperWizardStates < ActiveRecord::Migration[8.1]
  def change
    add_column :mapper_wizard_states, :query_params, :string
  end
end
