# frozen_string_literal: true

require 'faraday'
require 'faraday/retry'

# The HTTP client shared by everything that talks to an LLM provider: JSON in,
# JSON out, and a bounded backoff for the statuses a provider uses to say
# "later" rather than "no".
module LlmConnection
  # 429 is every provider's rate limit. 529 is "service overloaded", which
  # TypeSafe returns and which is likewise worth waiting out rather than
  # failing the judgement.
  RETRY_STATUSES = [ 429, 529 ].freeze

  # NOTE: faraday-retry only retries idempotent methods by default
  # (delete/get/head/options/put), so these statuses do *not* currently trigger
  # a retry for the POSTs a judge makes -- the config is inert for our calls.
  # Making it real means opting POST in, which is a behaviour change (a
  # rate-limited run would back off instead of marking the pair unrateable)
  # and belongs in its own change, not in this shared extraction.
  RETRY_OPTIONS = {
    max:                 3,
    interval:            2,
    interval_randomness: 0.5,
    backoff_factor:      2,
    retry_statuses:      RETRY_STATUSES,
  }.freeze

  def self.build url:
    Faraday.new(url: url) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
      f.request :retry, RETRY_OPTIONS.dup
    end
  end
end
