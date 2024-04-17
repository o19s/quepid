# frozen_string_literal: true

class RunCaseJob2 < ApplicationJob
  queue_as :single
  sidekiq_options retry: 0

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def perform user, kase, root_url
    api_key = nil
    if user.api_keys.empty?
      api_key = user.api_keys.create! token: SecureRandom.hex
      puts 'we made a api'
    else
      api_key = user.api_keys.first
    end

    puts "api_key is #{api_key.token_digest}"
    puts "kase has #{kase.queries.size}"
    kase.queries.each do |query|
      puts "root url is #{root_url}"
      # puts 'changing to https://localhost'
      # root_url = 'https://localhost/'
      url = "#{root_url}api/cases/#{kase.id}/queries/#{query.id}/agent_q"
      puts url
      # Create a Faraday connection
      connection = Faraday.new(url: url) do |faraday|
        # Set the request headers
        faraday.headers['Authorization'] = "Bearer #{api_key.token_digest}"
        faraday.headers['Accept'] = 'application/json'
        faraday.adapter Faraday.default_adapter
        faraday.ssl.verify = false # Disable SSL certificate validation
      end

      # Make the GET request
      response = connection.get
      puts 'I did a get'

      if :ok == response.status
        # Parse the response body as JSON
        data = JSON.parse(response.body)

        puts data
      else
        puts "Didn't get okay response.  #{response.status}"
        puts "Response.body: #{response.body}"

      end
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
