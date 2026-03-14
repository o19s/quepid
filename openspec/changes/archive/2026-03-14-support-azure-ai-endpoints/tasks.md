## 1. Service Layer

- [x] 1.1 Add `completions_path` and `auth_headers` private methods to `LlmService`
- [x] 1.2 Update `get_llm_response` to use `completions_path` and `auth_headers` instead of hardcoded values

## 2. Controller Defaults

- [x] 2.1 Add `llm_provider` and `llm_api_version` to default `judge_options` in `AiJudgesController#new`

## 3. Form View

- [x] 3.1 Render `llm_provider` as a `<select>` dropdown instead of text field in `_form.html.erb`
- [x] 3.2 Add JavaScript provider presets that auto-fill URL and API version on dropdown change

## 4. Tests

- [x] 4.1 Add Azure OpenAI URL and auth header test to `llm_service_test.rb`
- [x] 4.2 Add Azure AI Foundry URL and auth header test to `llm_service_test.rb`
- [x] 4.3 Add backward compatibility test for judges with no `llm_provider` set
- [x] 4.4 Run full test suite and verify green
