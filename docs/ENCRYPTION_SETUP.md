# ActiveRecord Encryption Setup

Quepid encrypts sensitive attributes at rest using [Active Record Encryption](https://guides.rubyonrails.org/active_record_encryption.html).

## Encrypted fields

| Model | Attribute | Purpose |
|-------|-----------|---------|
| `User` | `llm_key` | AI judge API keys |
| `SearchEndpoint` | `basic_auth_credential` | Search engine HTTP basic auth (`username:password`) |
| `MapperWizardState` | `basic_auth_credential` | Mapper wizard draft basic auth (same format) |

## Configuration

### 1. Encryption Keys

Encryption keys are set in `config/application.rb` via `ENV[...].presence` with committed defaults.

Generate values with `bin/rails db:encryption:init`, then set environment variables (see `.env.example`):

```bash
export ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY="your-primary-key"
export ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY="your-deterministic-key"
export ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT="your-salt"
```

If a variable is unset or set to an empty string, the default in `application.rb` is used. Set a non-empty value only when you intend to override the committed default.

### 2. Development Environment

For development and test environments, default keys are automatically used if the environment variables are unset. These should NEVER be used in production.

`config.active_record.encryption.support_unencrypted_data = true` in `application.rb` allows reading legacy plaintext rows during migration.

## Migration

To encrypt existing values in your database:

```bash
bundle exec rails db:migrate
```

- `EncryptExistingUserLlmKeys` — finds users with non-null `llm_key`, re-saves each record to trigger encryption, in batches
- `EncryptExistingBasicAuthCredentials` — re-saves `SearchEndpoint` and `MapperWizardState` rows that have basic auth credentials

Both require `support_unencrypted_data = true` (already set in `application.rb`).

**Back up the database before migrating.** These migrations are not reversible; ciphertext cannot be turned back into plaintext via `db:rollback`.

## Usage examples

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
bundle exec rails test test/models/search_endpoint_test.rb
```

## Important Notes

1. **Backup your database** before running the encryption migration
2. The encryption migration is **not reversible** - once encrypted, you cannot decrypt back to plaintext through migrations
3. Keep your encryption keys secure and backed up - losing them means losing access to encrypted data
4. The application supports reading unencrypted data during the transition period (`support_unencrypted_data = true`)
5. After all data is encrypted and verified, you may want to set `support_unencrypted_data = false` for additional security

## Troubleshooting

If you encounter issues:

1. Ensure all three `ACTIVE_RECORD_ENCRYPTION_*` environment variables are unset or non-empty (blank values fall back to defaults)
2. Keep the same key values across deploys; changing keys without re-encrypting makes existing data unreadable
3. For `Missing Active Record encryption credential: active_record_encryption.primary_key` on case API loads, check keys in `application.rb` and basic auth on tries (`app/views/api/v1/tries/_try.json.jbuilder`)
4. Check logs for any encryption-related errors during migration
