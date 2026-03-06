class EncryptExistingBasicAuthCredentials < ActiveRecord::Migration[8.0]
  def up
    unless Rails.application.config.active_record.encryption.support_unencrypted_data
      raise StandardError, <<~ERROR
        This migration requires support_unencrypted_data to be enabled for Active Record Encryption.

        Please add the following to your application configuration before running this migration:

        # In config/application.rb or an initializer:
        config.active_record.encryption.support_unencrypted_data = true

        After the migration completes, you can disable this setting if desired.
      ERROR
    end

    SearchEndpoint.where.not(basic_auth_credential: [ nil, '' ]).find_each do |endpoint|
      credential = endpoint.basic_auth_credential
      next if credential.blank?

      endpoint.basic_auth_credential = credential
      endpoint.save!(validate: false)
    end

    MapperWizardState.where.not(basic_auth_credential: [ nil, '' ]).find_each do |state|
      credential = state.basic_auth_credential
      next if credential.blank?

      state.basic_auth_credential = credential
      state.save!(validate: false)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Cannot decrypt basic_auth_credentials back to plaintext"
  end
end
