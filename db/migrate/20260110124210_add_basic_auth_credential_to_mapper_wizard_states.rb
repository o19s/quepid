class AddBasicAuthCredentialToMapperWizardStates < ActiveRecord::Migration[8.1]
  def change
    add_column :mapper_wizard_states, :basic_auth_credential, :string
  end
end
