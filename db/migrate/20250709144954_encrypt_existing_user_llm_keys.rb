class EncryptExistingUserLlmKeys < ActiveRecord::Migration[8.0]
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
    
    # Process users in batches to avoid memory issues with large datasets
    User.where.not(llm_key: nil).find_each do |user|
      # Read the unencrypted value
      unencrypted_llm_key = user.llm_key
      
      # Skip if blank
      next if unencrypted_llm_key.blank?
      
      # Re-save to trigger encryption
      user.update_column(:llm_key, unencrypted_llm_key)
    end
  
  end
  
  def down
    # This migration is not reversible as we cannot decrypt without storing the original values
    raise ActiveRecord::IrreversibleMigration, "Cannot decrypt llm_keys back to plaintext"
  end
end
