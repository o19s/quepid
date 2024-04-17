# frozen_string_literal: true

class RunCaseJob < ApplicationJob
  queue_as :single
  sidekiq_options retry: 0

  @browser = nil

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def perform user, kase
    api_key = nil
    if user.api_keys.empty?
      api_key = user.api_keys.create! token: SecureRandom.hex
      puts 'we made a api'
    else
      api_key = user.api_keys.first
    end

    puts "api_key is #{api_key.token_digest}"

    retries = 3

    begin
      if @browser.nil?
        puts 'creating Ferrum Browser'
        # Launch Ferrum browser

        @browser = Ferrum::Browser.new({
          process_timeout: 5, headless: 'new',
          window_size: [ 1280, 800 ],
          browser_options: { 'no-sandbox': nil },
          timeout: 60,
          pending_connection_errors: false,
          js_errors: false

        })
      end

      # @browser.headers.set({ 'Authorization' => "Bearer #{api_key.token_digest}" })
      page = @browser.create_page
      page.headers.set({ 'Authorization' => "Bearer #{api_key.token_digest}" })

      kase.queries.each do |query|
        result = Benchmark.measure do
          # Perform a GET request
          # url = "http://localhost:3000/case/#{kase.id}/query/#{query.id}"
          url = "http://localhost:3000/case/#{kase.id}/query/#{query.id}"
          puts url
          page.go_to(url)
          page.network.wait_for_idle
        end

        puts result

        start_time = Time.zone.now

        counter = 30
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

        node = page.at_css('.snapshot-payload')

        if node.nil?
          puts 'We have a nil Node, so no response'
        else
          response = node.text
          puts response
        end
      end
    rescue Ferrum::BrowserError => e
      retries -= 1
      if retries.positive?
        puts "Ferrum BrowserError occurred: #{e.message}. Retrying..."
        retry
      else
        puts "Ferrum BrowserError occurred: #{e.message}. Maximum retries reached."
        # Handle the error or log it
      end
    rescue Ferrum::StatusError => e
      puts "Ferrum StatusError occurred: #{e.message}."
    ensure
      # @browser.close if @browser # not yet released
      puts 'about to reset browser'
      @browser.reset
      # @browser.quit
      # puts "browser quit"
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
end
