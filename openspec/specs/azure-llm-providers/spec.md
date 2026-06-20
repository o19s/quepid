## ADDED Requirements

### Requirement: Unified ruby_llm provider routing
LlmService SHALL route every request through the `ruby_llm` gem, selecting one of three native providers based on the `llm_provider` option.

#### Scenario: Azure providers route through ruby_llm `:azure`
- **WHEN** `llm_provider` is `azure_openai`, `azure_ai_foundry`, or `azure_ai_foundry_serverless`
- **THEN** the service SHALL configure `azure_api_base` from `llm_service_url`, `azure_api_key` from `llm_key`, and dispatch with `provider: :azure`

#### Scenario: Anthropic providers route through ruby_llm `:anthropic`
- **WHEN** `llm_provider` is `anthropic` or `azure_ai_foundry_anthropic`
- **THEN** the service SHALL configure `anthropic_api_base` from `llm_service_url`, `anthropic_api_key` from `llm_key`, and dispatch with `provider: :anthropic`

#### Scenario: OpenAI-compatible providers route through ruby_llm `:openai`
- **WHEN** `llm_provider` is `openai`, `google_gemini`, or unset
- **THEN** the service SHALL configure `openai_api_base` to `<llm_service_url>/v1`, `openai_api_key` from `llm_key`, and dispatch with `provider: :openai`

#### Scenario: Ollama routes through ruby_llm `:ollama`
- **WHEN** `llm_provider` is `ollama`
- **THEN** the service SHALL configure `ollama_api_base` to `<llm_service_url>/v1` and dispatch with `provider: :ollama`

### Requirement: Stored URL shapes match ruby_llm expectations
The `llm_service_url` stored in `judge_options` SHALL be the URL ruby_llm needs as its provider base, with any required api-version already embedded as a query string.

#### Scenario: Azure OpenAI stored URL
- **WHEN** an AI judge has `llm_provider` set to `azure_openai`
- **THEN** `llm_service_url` SHALL end with `/openai/v1` and ruby_llm SHALL POST to `<llm_service_url>/chat/completions`

#### Scenario: Azure AI Foundry stored URL
- **WHEN** an AI judge has `llm_provider` set to `azure_ai_foundry`
- **THEN** `llm_service_url` SHALL include an `?api-version=…` query string and ruby_llm SHALL POST to `<resource>/models/chat/completions?api-version=…`

#### Scenario: Azure AI Foundry Serverless stored URL
- **WHEN** an AI judge has `llm_provider` set to `azure_ai_foundry_serverless`
- **THEN** `llm_service_url` SHALL be the full chat-completions URL ending in `/v1/chat/completions` and ruby_llm SHALL POST to it directly

#### Scenario: Azure AI Foundry Anthropic stored URL
- **WHEN** an AI judge has `llm_provider` set to `azure_ai_foundry_anthropic`
- **THEN** `llm_service_url` SHALL be the Anthropic-flavored base (e.g. `https://RESOURCE.services.ai.azure.com/anthropic`) and ruby_llm SHALL POST to `<llm_service_url>/v1/messages`

### Requirement: Provider-aware authentication
LlmService SHALL delegate authentication headers to ruby_llm based on the selected provider.

#### Scenario: Azure providers send api-key header
- **WHEN** the resolved ruby_llm provider is `:azure`
- **THEN** the request SHALL include `api-key: <llm_key>` and SHALL NOT include `Authorization: Bearer`

#### Scenario: Anthropic providers send x-api-key and anthropic-version
- **WHEN** the resolved ruby_llm provider is `:anthropic`
- **THEN** the request SHALL include `x-api-key: <llm_key>` and `anthropic-version: 2023-06-01`

#### Scenario: OpenAI-compatible providers send Bearer
- **WHEN** the resolved ruby_llm provider is `:openai` or `:ollama`
- **THEN** the request SHALL include `Authorization: Bearer <llm_key>` (or no auth header if key is blank)

### Requirement: Provider dropdown in AI judge form
The AI judge form SHALL present a dropdown for provider selection with preset defaults.

#### Scenario: New judge form shows provider dropdown
- **WHEN** a user creates a new AI judge
- **THEN** the form SHALL display a dropdown with options: OpenAI, Azure OpenAI, Azure AI Foundry, Azure AI Foundry Serverless, Azure AI Foundry Anthropic, Anthropic, Google Gemini, Ollama

#### Scenario: Provider selection auto-fills URL
- **WHEN** a user selects a provider from the dropdown
- **THEN** the `llm_service_url` field SHALL be pre-filled with the ruby_llm-ready URL shape for that provider
