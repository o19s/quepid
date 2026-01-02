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

class ExperimentWithRubyLlmTest < ActionDispatch::IntegrationTest
  let(:user) { users(:doug) }
  let(:scorer) { scorers(:quepid_default_scorer) }
  let(:selection_strategy) { selection_strategies(:multiple_raters) }

  # rubocop:disable Style/ClassVars
  @@skip_tests = ENV.fetch('OPENAI_API_KEY', nil).nil?
  # rubocop:enable Style/ClassVars

  test 'Start a chat' do
    skip('Ignoring all tests in ExperimentWithRubyLlmTest') if @@skip_tests
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
    skip('Ignoring all tests in ExperimentWithRubyLlmTest') if @@skip_tests
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
    skip('Ignoring all tests in ExperimentWithRubyLlmTest') if @@skip_tests
    WebMock.allow_net_connect!
    RubyLLM.configure do |config|
      config.ollama_api_base = 'http://host.docker.internal:11434/v1'
    end

    # Same API, different model
    chat = RubyLLM.chat(model: 'qwen3:0.6b', provider: 'ollama')
    response = chat.ask("Explain Ruby's eigenclass")
    assert_not response.content.empty?

    assert true
  end

  # We believe that direct Ollama is two to four times
  # faster than the Docker Ollama image version, and used this test below to benchmark it
  test 'benchmark ollama docker image versus direct' do
    skip('Ignoring benchmark ollama in ExperimentWithRubyLlmTest')
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
