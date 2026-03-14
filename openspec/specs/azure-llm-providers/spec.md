## ADDED Requirements

### Requirement: Provider-aware authentication
LlmService SHALL use provider-specific authentication headers based on the `llm_provider` option.

#### Scenario: Azure OpenAI authentication
- **WHEN** an AI judge has `llm_provider` set to `azure_openai`
- **THEN** the LLM request SHALL include the header `api-key: <llm_key>` and SHALL NOT include `Authorization: Bearer`

#### Scenario: Azure AI Foundry authentication
- **WHEN** an AI judge has `llm_provider` set to `azure_ai_foundry` or `azure_ai_foundry_serverless`
- **THEN** the LLM request SHALL include the header `api-key: <llm_key>` and SHALL NOT include `Authorization: Bearer`

#### Scenario: Anthropic provider authentication
- **WHEN** an AI judge has `llm_provider` set to `anthropic` or `azure_ai_foundry_anthropic`
- **THEN** the LLM request SHALL include the header `x-api-key: <llm_key>` and the `anthropic-version: 2023-06-01` header

#### Scenario: OpenAI-compatible provider authentication
- **WHEN** an AI judge has `llm_provider` set to `openai`, `google_gemini`, `ollama`, or is unset
- **THEN** the LLM request SHALL include the header `Authorization: Bearer <llm_key>` (or no auth header if key is blank)

### Requirement: Provider-aware URL routing
LlmService SHALL construct the completions endpoint path based on the `llm_provider` value.

#### Scenario: Azure OpenAI URL with api-version
- **WHEN** `llm_provider` is `azure_openai` and `llm_api_version` is set (e.g. `2024-10-21`)
- **THEN** the POST path SHALL be `openai/deployments/<llm_model>/chat/completions?api-version=<llm_api_version>`

#### Scenario: Azure OpenAI URL without api-version
- **WHEN** `llm_provider` is `azure_openai` and `llm_api_version` is blank or unset
- **THEN** the POST path SHALL be `openai/v1/chat/completions`

#### Scenario: Azure AI Foundry URL
- **WHEN** `llm_provider` is `azure_ai_foundry` and `llm_api_version` is `2025-01-01-preview`
- **THEN** the POST path SHALL be `models/chat/completions?api-version=2025-01-01-preview`

#### Scenario: Azure AI Foundry default API version
- **WHEN** `llm_provider` is `azure_ai_foundry` and `llm_api_version` is blank or unset
- **THEN** the service SHALL default to `2025-01-01-preview`

#### Scenario: Azure AI Foundry Serverless URL
- **WHEN** `llm_provider` is `azure_ai_foundry_serverless`
- **THEN** the POST path SHALL be `v1/chat/completions`

#### Scenario: Anthropic provider URL
- **WHEN** `llm_provider` is `anthropic` or `azure_ai_foundry_anthropic`
- **THEN** the POST path SHALL be `v1/messages` and the Anthropic Messages API format SHALL be used

#### Scenario: Default URL for non-Azure providers
- **WHEN** `llm_provider` is `openai`, `google_gemini`, `ollama`, or unset
- **THEN** the POST path SHALL be `v1/chat/completions`

### Requirement: Backward compatibility
Existing AI judges without a `llm_provider` option SHALL continue to work identically to current behavior.

#### Scenario: Legacy judge with no provider set
- **WHEN** an existing AI judge has no `llm_provider` in its `judge_options`
- **THEN** the service SHALL use `v1/chat/completions` path and `Authorization: Bearer` auth, matching pre-change behavior

### Requirement: Provider dropdown in AI judge form
The AI judge form SHALL present a dropdown for provider selection with preset defaults.

#### Scenario: New judge form shows provider dropdown
- **WHEN** a user creates a new AI judge
- **THEN** the form SHALL display a dropdown with options: OpenAI, Azure OpenAI, Azure AI Foundry, Azure AI Foundry Serverless, Azure AI Foundry Anthropic, Anthropic, Google Gemini, Ollama

#### Scenario: Provider selection auto-fills defaults
- **WHEN** a user selects "Azure OpenAI" from the provider dropdown
- **THEN** the `llm_service_url` field SHALL be pre-filled with `https://RESOURCE.openai.azure.com`

### Requirement: API version configuration
AI judges for Azure providers SHALL support an `llm_api_version` field in `judge_options`.

#### Scenario: API version stored in judge options
- **WHEN** a user saves an Azure AI judge with `llm_api_version` set to `2025-04-01-preview`
- **THEN** the value SHALL be persisted in `judge_options` and used in subsequent LLM requests
