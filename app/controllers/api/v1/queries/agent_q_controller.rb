# frozen_string_literal: true

require 'ferrum'
require 'benchmark'

# NOTE: Auto reloading this file appears to not work.  If you change the file, quit Rails and restart it.
# I suspect something about how we are talking to Ferrum/Chrome.
#
# Also browser.quit causes Rails to quit too!
#
# rubocop:disable Metrics/MethodLength
module Api
  module V1
    module Queries
      class AgentQController < Queries::ApplicationController
        # skip_before_action :require_login
        skip_before_action :verify_authenticity_token, only: [ :fetch ]
        before_action :set_case, only: [ :fetch ]
        before_action :check_case, only: [ :fetch ]
        before_action :set_case_query, only: [ :fetch ]
        before_action :check_query, only: [ :fetch ]
        @browser = nil

        def fetch
          api_key = nil
          if @current_user.api_keys.empty?
            api_key = @current_user.api_keys.create! token: SecureRandom.hex
            puts 'we made a api'
          else
            api_key = @current_user.api_keys.first
          end

          puts "api_key is #{api_key.token_digest}"

          if @browser.nil?
            puts 'creating Ferrum Browser'
            # Launch Ferrum browser
            @browser = Ferrum::Browser.new({
              process_timeout: 5, headless: true,
              window_size: [ 1280, 800 ],
              browser_options: { 'no-sandbox': nil },
              timeout: 60,
              pending_connection_errors: false

            })
          end
          # @browser.headers.set({ 'Authorization' => "Bearer #{api_key.token_digest}" })
          page = @browser.create_page
          page.headers.set(
            { 'Authorization' => "Bearer #{api_key.token_digest}" }
          )

          counter = 30
          result = Benchmark.measure do
            # Perform a GET request
            #
            # api_case_query_agent_q_path
            puts "root url is #{root_url}"
            quepid_url = "#{root_url}case/#{@case.id}/query/#{@query.id}"
            # quepid_url = api_case_query_agent_q_url @case, @query
            puts "looking up #{quepid_url}"
            page.go_to(quepid_url)
            # page.network.wait_for_idle

            start_time = Time.zone.now

            # Run the loop for a maximum of 5 seconds
            # Timeout.timeout(60) do
            loop do
              break unless page.at_css('.snapshot-payload').nil?
              break if counter.zero?

              # Sleep for a short duration before checking the condition again

              counter -= 1
              sleep 1
            end
            puts "Condition met after #{Time.zone.now - start_time} seconds."
          end
          puts result

          node = page.at_css('.snapshot-payload')

          # @@browser.quit

          if node
            render json: node.text, status: :ok
          else
            render json: { agentq_error: 'boom', counter: counter }, status: :internal_server_error
          end
          # Close the browser
        end
      end
    end
  end
end
# rubocop:enable Metrics/MethodLength
