# frozen_string_literal: true

json.embedder_id    embedder.id
json.name           embedder.name
json.provider       embedder.provider
json.service_url    embedder.service_url
json.model          embedder.model
# Never the key itself: only whether one is set.
json.api_key        embedder.masked_api_key
json.dimensions     embedder.dimensions
json.truncation     embedder.truncation
json.instruction    embedder.instruction
json.input_template embedder.input_template
json.timeout        embedder.timeout
json.fingerprint    embedder.fingerprint
json.archived       embedder.archived
json.owner_id       embedder.owner_id
json.team_ids       embedder.team_ids
