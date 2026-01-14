class AddCustomHeadersToMapperWizardStates < ActiveRecord::Migration[8.1]
  def change
    add_column :mapper_wizard_states, :custom_headers, :text
  end
end
