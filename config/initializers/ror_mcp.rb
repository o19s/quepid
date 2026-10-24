# frozen_string_literal: true

# MCP server (ror-mcp-server) publishing Quepid's data to AI agents and MCP clients.
# Collections and toolsets live in app/mcp/. See docs/mcp_server.md.
#
# Disabled unless MCP_SERVER=true: the endpoint is only mounted (config/routes.rb)
# and only authenticates requests when the flag is set.
Rails.application.config.x.mcp_server_enabled = 'true'.casecmp?(ENV.fetch('MCP_SERVER', 'false').strip)

mcp_instructions = <<~TXT
  Quepid is a search relevance testing tool. This server exposes the Quepid data the
  API token's owner can see in Quepid itself, queried with query_data_collections,
  plus tools to create and change cases, queries, ratings and books.

  Collections: "case" (relevance-testing workspaces), "query" (search strings inside
  a case), "rating" (per-document judgements inside a case), "book" (reusable
  judgement corpora), "query_doc_pair" (query/document pairs inside a book),
  "judgement" (verdicts on those pairs), "try" (tuning iterations of a case),
  "snapshot" and "snapshot_query" (frozen results and their scores),
  "search_endpoint" (the search engines cases query), "scorer" (the metrics used to
  grade), "team" and "teams_case" (sharing), "ai_judge" (LLM-backed judges).

  Quepid has two parallel judgement worlds that are easy to confuse: a CASE holds
  queries and ratings; a BOOK holds query_doc_pairs and judgements. A case may draw on
  a book, but ratings and judgements are different tables. Never mix them in one answer
  without saying which side you used.

  There is no user collection: owner_id and user_id identify a person but cannot be
  resolved to a name here, so report them as ids.

  Resolve references with $lookup rather than returning raw ids. localField is the field
  name ("case", "query", "book"), not the "_id" form that appears in results.

  Results are already scoped to what the token's owner can see (owned, or shared with
  one of their teams). An empty result means the data is not shared with you, not that
  it does not exist. "Latest" means highest id.
TXT

RorMcp.configure do |c|
  c.default_server name: 'quepid', stateless: true, instructions: mcp_instructions

  # The same API keys as the REST API (Authorization: Bearer <key>, see ApiKeyAuthenticatable).
  c.authenticate do |request|
    next nil unless Rails.application.config.x.mcp_server_enabled

    token = request.authorization.to_s.delete_prefix('Bearer ').strip
    user = token.present? && ApiKey.find_by(token_digest: token)&.user
    user && !user.locked? ? { user: user } : nil
  end

  # One log line per call, since the request log only shows `POST "/mcp"`.
  c.on_query do |event|
    Rails.logger.info "[MCP] query #{event.collection} rows=#{event.rows} #{event.duration_ms.round}ms " \
                      "pipeline=#{event.pipeline.to_json}#{" error=#{event.error}" if event.error}"
  end
  c.on_tool do |event|
    Rails.logger.info "[MCP] tool #{event.tool} #{event.duration_ms.round}ms#{" error=#{event.error}" if event.error}"
  end

  c.statement_timeout = 15.seconds
  c.default_limit     = 100
  c.max_limit         = 1000
end
