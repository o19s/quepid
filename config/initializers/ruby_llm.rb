# frozen_string_literal: true

RubyLLM.configure do |config|
  config.openai_api_key = ENV.fetch('OPENAI_API_KEY', Rails.application.credentials[:openai_api_key])
  # config.default_model = "gpt-5-nano"

  config.ollama_api_base = 'http://ollama:31434/v1'

  # Use the new association-based acts_as API (recommended)
  config.use_new_acts_as = true
end

RubyLLM.models.refresh!
