class IncreaseBasicAuthCredentialMaxLength < ActiveRecord::Migration[8.0]
  def change
    change_column :search_endpoints, :basic_auth_credential, :string, limit: 4000
    change_column :mapper_wizard_states, :basic_auth_credential, :string, limit: 4000
  end
end
