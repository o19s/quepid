## Context

Quepid's AI judge system uses `LlmService` to make raw Faraday HTTP calls to OpenAI-compatible chat completions endpoints. The service hardcodes `v1/chat/completions` as the path and `Authorization: Bearer` as the auth header. Azure OpenAI and Azure AI Foundry use different URL patterns and `api-key` header authentication, making them incompatible with the current implementation.

All LLM configuration is per-judge, stored as schema-free JSON in the `users.options` column under the `judge_options` key. The form dynamically renders all keys in this hash as form fields.

## Goals / Non-Goals

**Goals:**
- Support Azure OpenAI endpoints (`{endpoint}/openai/v1/chat/completions?api-version=...`)
- Support Azure AI Foundry endpoints (`{endpoint}/models/chat/completions?api-version=...`)
- Add a provider dropdown to the AI judge form for guided configuration
- Maintain full backward compatibility with existing judges
- Zero database migrations

**Non-Goals:**
- Environment variable-based configuration (all config remains per-judge)
- Provider-specific SDK gems (continue using raw Faraday HTTP)
- Azure Entra ID / OAuth token-based auth (only API key auth)
- Provider class hierarchy or strategy pattern (simple case statement suffices for 6 providers)

## Decisions

### 1. Two new `judge_options` keys instead of a custom_headers field

Add `llm_provider` (string enum) and `llm_api_version` (string) to `judge_options`. The service branches on `llm_provider` to determine URL path and auth header.

**Alternative considered:** A generic `custom_headers` JSON field (like `SearchEndpoint` has). Rejected because it shifts complexity to the user — they'd need to know the exact header name and URL pattern for each provider. The dropdown approach is more user-friendly and less error-prone.

### 2. Provider routing in LlmService via case statement

A simple `case @options[:llm_provider]` in two private methods (`completions_path`, `auth_headers`). No class hierarchy, no registry pattern.

**Alternative considered:** Strategy pattern with per-provider classes. Rejected as over-engineering for 6 providers that differ only in URL path and auth header. The case statement is ~15 lines total.

### 3. Azure OpenAI v1 API (not deployment-based)

Use Azure OpenAI's newer v1-compatible API (`/openai/v1/chat/completions` with `model` in the body) instead of the legacy deployment-based path (`/openai/deployments/{id}/chat/completions`).

**Rationale:** The v1 API is simpler, aligns with OpenAI's format, and doesn't require encoding deployment IDs in URLs. The `model` field is already part of `judge_options`.

### 4. Inline JS for provider presets instead of Stimulus controller

Add a small JavaScript block to the existing form partial's `<script>` tag that listens to the provider dropdown change event and auto-fills URL/api-version fields.

**Rationale:** The existing form already uses inline JS for tab switching. Adding a Stimulus controller for one dropdown event is unnecessary overhead. Consistent with existing pattern.

## Risks / Trade-offs

- **[Risk] Azure API version drift** → Mitigated by making `llm_api_version` user-configurable with a sensible default (`2025-01-01-preview`). Users can update it without code changes.
- **[Risk] Provider list maintenance in two places** (controller defaults + service routing) → Acceptable for 6 providers. Adding a 7th requires ~4 lines in each file.
- **[Risk] Faraday query string in path** → Verified: `conn.post('path?key=val')` works correctly with Faraday's JSON middleware. The query string is preserved.
- **[Trade-off] `llm_api_version` field visible for non-Azure providers** → It renders as an empty text field, which is harmless. Hiding it conditionally would require more JS complexity than warranted.
