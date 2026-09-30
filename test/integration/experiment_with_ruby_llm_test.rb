# frozen_string_literal: true

require 'test_helper'

# Opt-in smoke check of RubyLLM's own provider-swapping against a real Ollama. Nothing in the app
# wires RubyLLM to Ollama (only LlmService does that, via its own Faraday client -- see
# LlmServiceTest's "using ollama" tests). The real RubyLLM pipeline that ships
# (MapperWizardService#generate_mappers / #refine_mapper) is covered with stubbed HTTP in
# test/integration/experiment_with_ruby_llm_extractor_test.rb, and the tools in
# test/integration/mapper_tool_test.rb and test/services/mapper_wizard_service_test.rb.
class ExperimentWithRubyLlmTest < ActionDispatch::IntegrationTest
  OLLAMA_HOST = 'ollama'
  OLLAMA_PORT = 31_434

  def ollama_available?
    Socket.tcp(OLLAMA_HOST, OLLAMA_PORT, connect_timeout: 1) { true }
  rescue Errno::ECONNREFUSED, Errno::EHOSTUNREACH, SocketError, Errno::ETIMEDOUT
    false
  end

  test 'play with ollama' do
    unless ollama_available?
      skip "Ollama not reachable at #{OLLAMA_HOST}:#{OLLAMA_PORT} -- start it via bin/docker s " \
           '(the ollama service in docker-compose.yml) and pull qwen3:0.6b to run this for ' \
           'real. Nothing in the app wires RubyLLM to Ollama today (only LlmService does, via ' \
           "its own Faraday client), so this is a smoke check of RubyLLM's own provider-" \
           'swapping capability, not app behavior.'
    end

    begin
      WebMock.allow_net_connect!
      RubyLLM.configure do |config|
        config.ollama_api_base = "http://#{OLLAMA_HOST}:#{OLLAMA_PORT}/v1"
      end

      # Same API, different model
      chat = RubyLLM.chat(model: 'qwen3:0.6b', provider: 'ollama')
      response = chat.ask("Explain Ruby's eigenclass")
      assert_not response.content.empty?
    ensure
      WebMock.disable_net_connect!
    end
  end
end
