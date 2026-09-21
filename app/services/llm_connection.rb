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

  # faraday-retry's own default method list: safe to repeat a request that
  # changes nothing, whatever went wrong.
  IDEMPOTENT_METHODS = [ :delete, :get, :head, :options, :put ].freeze

  # A judge's calls are all POSTs, which `methods` deliberately leaves out --
  # repeating a POST can mean paying for the same completion twice. `retry_if`
  # narrows the exception instead of the verb: Faraday::RetriableResponse is the
  # synthetic error the middleware raises *only* for RETRY_STATUSES, so a POST
  # is retried when the provider explicitly said "too many" or "overloaded"
  # (no completion was produced, so nothing is paid for twice) and is not
  # retried on a timeout or a connection failure, where the request may well
  # have been processed.
  RETRY_OPTIONS = {
    max:                 3,
    interval_randomness: 0.5,
    backoff_factor:      2,
    retry_statuses:      RETRY_STATUSES,
    methods:             IDEMPOTENT_METHODS,
    retry_if:            ->(_env, exception) { exception.is_a?(Faraday::RetriableResponse) },
  }.freeze

  # @param retry_options [Hash] overrides merged over RETRY_OPTIONS; tests use it
  #   to collapse the backoff further, callers may use it to tune attempts.
  def self.build url:, retry_options: {}
    Faraday.new(url: url) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
      f.request :retry, options(retry_options)
    end
  end

  def self.options overrides = {}
    RETRY_OPTIONS.merge(interval: Rails.configuration.llm_retry_interval).merge(overrides)
  end
end
