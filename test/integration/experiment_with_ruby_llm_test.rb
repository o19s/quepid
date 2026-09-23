# frozen_string_literal: true

require 'test_helper'
require 'benchmark'
require 'nokogiri'

require 'tzinfo'

class TimeInfo < RubyLLM::Tool
  description 'Gets the current time in various timezones'
  param :timezone,
        desc: "Timezone name (e.g., 'UTC', 'America/New_York')"

  def execute timezone:
    time = TZInfo::Timezone.get(timezone).now.strftime('%Y-%m-%d %H:%M:%S')
    "Current time in #{timezone}: #{time}"
  rescue StandardError => e
    { error: e.message }
  end
end

class Weather < RubyLLM::Tool
  description 'Gets current weather for a location'
  param :latitude, desc: 'Latitude (e.g., 52.5200)'
  param :longitude, desc: 'Longitude (e.g., 13.4050)'

  def execute latitude:, longitude:
    url = "https://api.open-meteo.com/v1/forecast?latitude=#{latitude}&longitude=#{longitude}&current=temperature_2m,wind_speed_10m"

    response = Faraday.get(url)
    JSON.parse(response.body)
  rescue StandardError => e
    { error: e.message }
  end
end

# These tests predate MapperWizardService (app/services/mapper_wizard_service.rb) -- they were
# written to learn the raw RubyLLM gem API (chat, tool-calling, provider-swapping) before that
# service existed. RubyLLM itself is very much live production code today (see
# MapperWizardService#generate_mappers / #refine_mapper), but most of what's explored below was
# NOT carried into the shipped implementation:
#   - MapperWizardService never calls `chat.with_tools` -- app/tools/* (DownloadPage, MapperTool,
#     JavascriptExtractor) are invoked directly (`DownloadPage.new.execute(...)`), so the
#     LLM-driven agentic tool-calling loop demonstrated here (Weather/TimeInfo, on_tool_call) has
#     no production equivalent left to test against.
#   - Plain `RubyLLM.chat(...).ask(...)` IS what generate_mappers/refine_mapper do, and that is
#     now covered for real -- stubbed HTTP, no live network or API key needed -- by the
#     fetch/generate/execute pipeline test in
#     test/integration/experiment_with_ruby_llm_extractor_test.rb.
#   - Nothing in the app wires RubyLLM to Ollama (only LlmService does that, via its own Faraday
#     client -- see LlmServiceTest's "using ollama" tests); the RubyLLM+Ollama test below is kept
#     only as an opt-in smoke check of RubyLLM's own provider-swapping against a real Ollama.
class ExperimentWithRubyLlmTest < ActionDispatch::IntegrationTest
  OLLAMA_HOST = 'ollama'
  OLLAMA_PORT = 31_434

  def ollama_available?
    Socket.tcp(OLLAMA_HOST, OLLAMA_PORT, connect_timeout: 1) { true }
  rescue Errno::ECONNREFUSED, Errno::EHOSTUNREACH, SocketError, Errno::ETIMEDOUT
    false
  end

  test 'Start a chat' do
    skip 'Superseded: this only demonstrated the raw RubyLLM.chat API against a real OpenAI ' \
         'account, requiring a live OPENAI_API_KEY and outbound network access. What actually ' \
         'ships (MapperWizardService#generate_mappers) is covered for real, with a stubbed ' \
         'HTTP response and no live network needed, in ' \
         'test/integration/experiment_with_ruby_llm_extractor_test.rb.'
    WebMock.allow_net_connect!
    RubyLLM.configure do |config|
      config.openai_api_key = ENV.fetch('OPENAI_API_KEY', nil)
    end

    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.ask "What's the difference between attr_reader and attr_accessor?" do |chunk|
      # Each chunk contains a portion of the response
      # print chunk.content
    end
    assert true
  end

  test 'tools' do
    skip 'Obsolete: prototyped an LLM-driven agentic tool-calling loop (chat.with_tools + ' \
         'chat.on_tool_call) that was not adopted. MapperWizardService and app/tools/* are ' \
         'invoked directly by app code (SomeTool.new.execute(...)), never through ' \
         'chat.with_tools, so there is no production tool-calling loop left to verify here. ' \
         'Real coverage of the actual tools, exercised the way the app calls them, lives in ' \
         'test/integration/mapper_tool_test.rb and test/services/mapper_wizard_service_test.rb. ' \
         'Reviving this would require the app itself adopting an agentic tool-calling flow, ' \
         'plus a live/stubbed OPENAI_API_KEY.'
    WebMock.allow_net_connect!
    RubyLLM.configure do |config|
      config.openai_api_key = ENV.fetch('OPENAI_API_KEY', nil)
    end

    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.with_tools(Weather, TimeInfo)

    chat.ask "What's the temperature in Rome?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    chat.ask "What's the time in Tokyo?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    assert true
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

  # We believe that direct Ollama is two to four times faster than the Docker Ollama image
  # version, and used this test below to benchmark it. It has no assertions -- it's a manual
  # performance-comparison tool, not a correctness/regression test -- so it stays permanently
  # skipped in CI; remove the skip locally to run it by hand against a real Ollama.
  test 'benchmark ollama docker image versus direct' do
    skip 'Manual benchmark only -- no assertions, not meant to run in CI. Remove this skip ' \
         'locally to run it by hand against a real Ollama.'
    WebMock.allow_net_connect!
    RubyLLM.configure do |config|
      config.ollama_api_base = 'http://host.docker.internal:11434/v1'
    end
    chat = RubyLLM.chat(model: 'qwen3:0.6b', provider: 'ollama')
    result = Benchmark.measure do
      2.times do
        chat.ask('what are ducks?')
        puts '.'
      end
    end

    # Print the elapsed time
    puts "Ollama qwen3:0.6b Elapsed time: #{result.real} seconds\n"

    RubyLLM.configure do |config|
      config.ollama_api_base = 'http://ollama:11434/v1'
      config.request_timeout = 120
    end
    chat = RubyLLM.chat(model: 'qwen3:0.6b', provider: 'ollama')
    result = Benchmark.measure do
      2.times do
        chat.ask('what are ducks?')
        puts '.'
      end
    end

    # Print the elapsed time
    puts "Ollama Docker qwen3:0.6b Elapsed time: #{result.real} seconds\n"
  end
end
