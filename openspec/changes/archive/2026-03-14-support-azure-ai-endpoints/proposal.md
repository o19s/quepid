## Why

Quepid's AI judge system supports OpenAI, Anthropic, Gemini, and Ollama via OpenAI-compatible endpoints, but cannot connect to Azure OpenAI or Azure AI Foundry models. Azure uses a different authentication header (`api-key` instead of `Authorization: Bearer`) and different URL path patterns. Many organizations deploy LLMs exclusively through Azure, making this a blocker for enterprise adoption.

## What Changes

- Add a `llm_provider` field to AI judge configuration with a dropdown selector for: OpenAI, Azure OpenAI, Azure AI Foundry, Anthropic, Google Gemini, Ollama
- `LlmService` routes auth headers and URL paths based on the selected provider
- Azure providers use `api-key` header and provider-specific completions paths with `api-version` query parameter
- Add `llm_api_version` field for Azure providers to specify the API version
- Provider dropdown auto-fills URL and API version defaults when selected
- Fully backward compatible: existing judges with no `llm_provider` continue working unchanged

## Capabilities

### New Capabilities
- `azure-llm-providers`: Support for Azure OpenAI and Azure AI Foundry endpoints in the AI judge LLM service, including provider-specific authentication and URL routing

### Modified Capabilities

## Impact

- `app/services/llm_service.rb` — URL path and auth header logic branching on provider
- `app/controllers/ai_judges_controller.rb` — new default judge_options keys
- `app/views/ai_judges/_form.html.erb` — provider dropdown and JS presets
- `test/services/llm_service_test.rb` — new test cases for Azure endpoints
- No database migrations (schema-free JSON column)
- No new gem dependencies
