# ActiveRecord Encryption Setup

This document describes how Quepid encrypts secrets at rest with ActiveRecord encryption.

## Overview

These attributes are encrypted (`encrypts ..., deterministic: false`), so the secrets they hold are never stored in plaintext in the database:

| Model | Attribute | Holds |
|---|---|---|
| `Connection` | `secret` | The key or credentials a connection sends to an LLM, embedding or search provider |
| `SearchEndpoint` | `basic_auth_credential` | A search endpoint's basic-auth `user:password` |
| `MapperWizardState` | `basic_auth_credential` | The same, while the mapper wizard is in progress |

AI judges and embedders keep no keys of their own: they call their providers through a `Connection` (see [ADR 0005](adr/0005-connections-for-external-services.md)).

## Configuration

### 1. Encryption Keys

The encryption requires three keys to be configured. Set the following environment variables:

```bash
export ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY="your-32-char-key"
export ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT="your-32-char-salt"
export ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY="your-32-char-primary-key"
```

### 2. Development Environment

For development and test environments, default keys are automatically used if no credentials or environment variables are set. These should NEVER be used in production.

## Usage

Once configured, encryption happens automatically:

```ruby
connection = Connection.create!(name: 'OpenAI', provider: 'openai', base_url: 'https://api.openai.com',
                                auth_scheme: 'bearer', secret: 'sk-1234567890', owner: user)

connection.secret  # => "sk-1234567890" (decrypted on read)

# The value in the database is encrypted: direct SQL queries return ciphertext.
```

## Important Notes

1. Keep your encryption keys secure and backed up - losing them means losing access to encrypted data.
2. The application supports reading unencrypted data during a transition period (`support_unencrypted_data = true`). Once all data is encrypted and verified, you may want to set it to `false` for additional security.

## Troubleshooting

If you encounter issues:

1. Ensure all three encryption keys are properly configured
2. Check that the keys are exactly 32 characters long
3. Verify Rails can access the credentials: `Rails.application.credentials.active_record_encryption`
4. Check logs for any encryption-related errors
