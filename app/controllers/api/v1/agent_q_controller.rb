# frozen_string_literal: true

require 'ferrum'
require 'benchmark'

# Note:  Auto reloading this file appears to not work.  If you change the file, quit Rails and restart it.
# I suspect something about how we are talking to Ferrum/Chrome.
# 
# Also browser.quit causes Rails to quit too!
# 
# rubocop:disable Layout/LineLength
# rubocop:disable Metrics/MethodLength
module Api
  module V1
    class AgentQController <  Api::ApiController
      #skip_before_action :require_login
      skip_before_action :verify_authenticity_token, only: [ :fetch ]
      @browser = nil
      
      def trigger
        kase = Case.find(4)
        RunCaseJob.perform_later kase.owner, kase
        
        render json: { message: 'scheduled' }, status: :ok
      end

      def fetch
        
        api_key = nil
        if @current_user.api_keys.empty?
          api_key = @current_user.api_keys.create! token: SecureRandom.hex
          puts "we made a api"
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
        @browser.headers.set({ 'Authorization' => "Bearer #{api_key.token_digest}" })
        page = @browser.create_page
        page.headers.set({ 'Authorization' => "Bearer #{api_key.token_digest}" })
    
        result = Benchmark.measure do
          # Perform a GET request
          page.go_to('http://localhost:3000/case/4/query/5')
          # page.network.wait_for_idle
        
      
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
         end
        
        puts result
    
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
# rubocop:enable Layout/LineLength
# rubocop:enable Metrics/MethodLength
