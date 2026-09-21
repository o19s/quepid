# frozen_string_literal: true

# One adapter per API dialect an LLM judge can speak.
#
# An adapter knows two things and nothing else: how to turn a query/doc pair
# into a request (as inert data -- see Base#request_envelope), and how to read
# a provider's answer back onto a Judgement. It performs no I/O, so the same
# adapter serves a live call and, later, a request built now and answered
# hours later by a batch API.
module LlmJudgeAdapters
  # Judges created before providers were a concept have no llm_provider at all;
  # they were, and remain, OpenAI-shaped.
  DEFAULT_ADAPTER = 'LlmJudgeAdapters::OpenAi'

  def self.for llm_key, options = {}
    provider = LlmProviders[options[:llm_provider]]

    raise "#{provider.label} is not available as an LLM judge yet, so it cannot be used to judge" if provider&.coming_soon?

    (provider&.adapter || DEFAULT_ADAPTER).constantize.new(llm_key, options)
  end
end
