## ADDED Requirements

### Requirement: Provider-aware authentication
LlmService SHALL use the `api-key` HTTP header for Azure providers and `Authorization: Bearer` for all other providers.

#### Scenario: Azure OpenAI authentication
- **WHEN** an AI judge has `llm_provider` set to `azure_openai`
- **THEN** the LLM request SHALL include the header `api-key: <llm_key>` and SHALL NOT include `Authorization: Bearer`

#### Scenario: Azure AI Foundry authentication
- **WHEN** an AI judge has `llm_provider` set to `azure_ai_foundry`
- **THEN** the LLM request SHALL include the header `api-key: <llm_key>` and SHALL NOT include `Authorization: Bearer`

#### Scenario: OpenAI-compatible provider authentication
- **WHEN** an AI judge has `llm_provider` set to `openai`, `anthropic`, `google_gemini`, `ollama`, or is unset
- **THEN** the LLM request SHALL include the header `Authorization: Bearer <llm_key>` (or no auth header if key is blank)

### Requirement: Provider-aware URL routing
LlmService SHALL construct the completions endpoint path based on the `llm_provider` value.

#### Scenario: Azure OpenAI URL
- **WHEN** `llm_provider` is `azure_openai` and `llm_api_version` is `2025-01-01-preview`
- **THEN** the POST path SHALL be `openai/v1/chat/completions?api-version=2025-01-01-preview`

#### Scenario: Azure AI Foundry URL
- **WHEN** `llm_provider` is `azure_ai_foundry` and `llm_api_version` is `2025-01-01-preview`
- **THEN** the POST path SHALL be `models/chat/completions?api-version=2025-01-01-preview`

#### Scenario: Default URL for non-Azure providers
- **WHEN** `llm_provider` is `openai`, `anthropic`, `google_gemini`, `ollama`, or unset
- **THEN** the POST path SHALL be `v1/chat/completions`

#### Scenario: Default API version
- **WHEN** `llm_provider` is an Azure provider and `llm_api_version` is blank or unset
- **THEN** the service SHALL default to `2025-01-01-preview`

### Requirement: Backward compatibility
Existing AI judges without a `llm_provider` option SHALL continue to work identically to current behavior.

#### Scenario: Legacy judge with no provider set
- **WHEN** an existing AI judge has no `llm_provider` in its `judge_options`
- **THEN** the service SHALL use `v1/chat/completions` path and `Authorization: Bearer` auth, matching pre-change behavior

### Requirement: Provider dropdown in AI judge form
The AI judge form SHALL present a dropdown for provider selection with preset defaults.

#### Scenario: New judge form shows provider dropdown
- **WHEN** a user creates a new AI judge
- **THEN** the form SHALL display a dropdown with options: OpenAI, Azure OpenAI, Azure AI Foundry, Anthropic, Google Gemini, Ollama

#### Scenario: Provider selection auto-fills defaults
- **WHEN** a user selects "Azure OpenAI" from the provider dropdown
- **THEN** the `llm_service_url` field SHALL be pre-filled with `https://RESOURCE.openai.azure.com` and `llm_api_version` with `2025-01-01-preview`

### Requirement: API version configuration
AI judges for Azure providers SHALL support an `llm_api_version` field in `judge_options`.

#### Scenario: API version stored in judge options
- **WHEN** a user saves an Azure AI judge with `llm_api_version` set to `2025-04-01-preview`
- **THEN** the value SHALL be persisted in `judge_options` and used in subsequent LLM requests
