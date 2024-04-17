# frozen_string_literal: true

class RunCaseJob2 < ApplicationJob
  queue_as :single
  sidekiq_options retry: 0

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def perform user, kase
    api_key = nil
    if user.api_keys.empty?
      api_key = user.api_keys.create! token: SecureRandom.hex
      puts 'we made a api'
    else
      api_key = user.api_keys.first
    end

    puts "api_key is #{api_key.token_digest}"

    kase.queries.each do |query|
      Benchmark.measure do
        url = "http://localhost:3000/api/cases/#{kase.id}/queries/#{query.id}/agent_q"
        puts url
        # Create a Faraday connection
        connection = Faraday.new(url: url) do |faraday|
          # Set the request headers
          faraday.headers['Authorization'] = "Bearer #{api_key.token_digest}"
          faraday.headers['Accept'] = 'application/json'
          faraday.adapter Faraday.default_adapter
        end

        # Make the GET request
        response = connection.get
        puts 'I did a get'
        # Parse the response body as JSON
        data = JSON.parse(response.body)

        puts data
      end
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
