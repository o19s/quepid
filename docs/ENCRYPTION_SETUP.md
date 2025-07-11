# ActiveRecord Encryption Setup for LLM Keys

This document describes the encryption setup for User's `llm_key` field in Quepid.

## Overview

The `llm_key` field in the User model is now encrypted using ActiveRecord encryption. This ensures that sensitive API keys are not stored in plaintext in the database.

## Configuration

### 1. Encryption Keys

The encryption requires three keys to be configured. You can set these up in one of two ways:

Set the following environment variables:
```bash
export ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY="your-32-char-key"
export ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT="your-32-char-salt"
export ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY="your-32-char-primary-key"
```

### 2. Development Environment

For development and test environments, default keys are automatically used if no credentials or environment variables are set. These should NEVER be used in production.

## Migration

To encrypt existing `llm_key` values in your database:

```bash
bundle exec rails db:migrate
```

The migration `EncryptExistingUserLlmKeys` will:
1. Find all users with non-null `llm_key` values
2. Re-save each record to trigger encryption
3. Process records in batches to handle large datasets efficiently

## Usage

Once configured, encryption happens automatically:

```ruby
# Creating a new AI judge user
user = User.create!(
  email: 'ai@example.com',
  password: 'secure_password',
  llm_key: 'sk-1234567890',  # This will be encrypted
  system_prompt: 'You are a helpful assistant'
)

# Reading the llm_key (automatically decrypted)
user.llm_key  # => "sk-1234567890"

# The value in the database is encrypted
# Direct SQL queries will return encrypted data
```

## Testing

Run the encryption tests:
```bash
bundle exec rails test test/models/user_llm_key_encryption_test.rb
```

## Important Notes

1. **Backup your database** before running the encryption migration
2. The encryption migration is **not reversible** - once encrypted, you cannot decrypt back to plaintext through migrations
3. Keep your encryption keys secure and backed up - losing them means losing access to encrypted data
4. The application supports reading unencrypted data during the transition period (`support_unencrypted_data = true`)
5. After all data is encrypted and verified, you may want to set `support_unencrypted_data = false` for additional security

## Troubleshooting

If you encounter issues:

1. Ensure all three encryption keys are properly configured
2. Check that the keys are exactly 32 characters long
3. Verify Rails can access the credentials: `Rails.application.credentials.active_record_encryption`
4. Check logs for any encryption-related errors during migration
