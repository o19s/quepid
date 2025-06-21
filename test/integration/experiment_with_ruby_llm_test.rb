# frozen_string_literal: true

require 'test_helper'
require 'benchmark'
require 'nokogiri'

require 'tzinfo'

class TimeInfo < RubyLLM::Tool
  description 'Gets the current time in various timezones'
  param :timezone,
        desc: "Timezone name (e.g., 'UTC', 'America/New_York')"

  def execute(timezone:)
    time = TZInfo::Timezone.get(timezone).now.strftime('%Y-%m-%d %H:%M:%S')
    "Current time in #{timezone}: #{time}"
   rescue StandardError => e
      { error: e.message }
   end
end

class Weather < RubyLLM::Tool
  description "Gets current weather for a location"
  param :latitude, desc: "Latitude (e.g., 52.5200)"
  param :longitude, desc: "Longitude (e.g., 13.4050)"

  def execute(latitude:, longitude:)
    url = "https://api.open-meteo.com/v1/forecast?latitude=#{latitude}&longitude=#{longitude}&current=temperature_2m,wind_speed_10m"

    response = Faraday.get(url)
    data = JSON.parse(response.body)
  rescue => e
    { error: e.message }
  end
end

class DownloadPage < RubyLLM::Tool
  description "Downloads a specific web search results page"
  param :url, desc: "Webpage Search Results URL (e.g., https://search.ed.ac.uk/?q=mental)"

  def execute(url:)
    #url = "https://api.open-meteo.com/v1/forecast?latitude=#{latitude}&longitude=#{longitude}&current=temperature_2m,wind_speed_10m"

    response = Faraday.get(url)
    #data = JSON.parse(response.body)
    data = response.body
    # assuming it's html not json
    clean_html = strip_css_styling(data)
    #puts clean_html
    clean_html
    
  rescue => e
    { error: e.message }
  end
  
  def strip_css_styling(html)
    doc = Nokogiri::HTML(html)
    
    # Remove all style tags
    doc.css('style').remove
    
    # Remove all link tags that reference stylesheets
    doc.css('link[rel="stylesheet"]').remove
    
    # Remove inline style attributes from all elements
    doc.css('[style]').each do |element|
      element.remove_attribute('style')
    end
    
    # Remove class attributes (optional, but often used for styling)
    doc.css('[class]').each do |element|
      element.remove_attribute('class')
    end
    
    # Remove JavaScript
    doc.css('script').remove                     # Remove script tags
    doc.xpath('//@*[starts-with(name(), "on")]').each do |attr|
      attr.remove                                # Remove all event handlers (onclick, onload, etc.)
    end
    doc.css('[href^="javascript:"]').each do |el|
      el.remove_attribute('href')                # Remove javascript: URLs
    end    
  
    # Return the cleaned HTML
    doc.to_html
  end
end

class ExperimentWithRubyLlmTest < ActionDispatch::IntegrationTest
  # rubocop:disable Rails/SkipsModelValidations
  let(:user) { users(:doug) }
  let(:scorer) { scorers(:quepid_default_scorer) }
  let(:selection_strategy) { selection_strategies(:multiple_raters) }

  # rubocop:disable Style/ClassVars
  @@skip_tests = false
  # rubocop:enable Style/ClassVars

  test 'generate and import query/doc pairs with traditional AR' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    WebMock.allow_net_connect!
    RubyLLM.configure do |config|
      config.openai_api_key = ENV['OPENAI_API_KEY']
    end
    
    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.ask "What's the difference between attr_reader and attr_accessor?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
  end
  
  test 'tools' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    WebMock.allow_net_connect!
  RubyLLM.configure do |config|
    config.openai_api_key = ENV['OPENAI_API_KEY']
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
  end
  
  test 'download page' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    WebMock.allow_net_connect!
  
    RubyLLM.configure do |config|
      config.openai_api_key = ENV['OPENAI_API_KEY']
    end
    
    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.with_tools(DownloadPage)
    
    chat.ask "What is the title of the web page https://search.ed.ac.uk/?q=mental" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    chat.ask "Can you print out the search query that was used to fetch the page?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    chat.ask "Can you print out how many total results were found?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    chat.ask "Can you print out how many individual results were returned in the current page?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    puts "BREAK"
    chat.ask "For each individual result, can you print out the result in JSON format?  Please include the date, description, any url" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    puts "AWESOME"
    chat.ask "Can you generate the JavaScript required to take the raw HTML and convert it to the JSON format you previously used?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
  end
  
  test 'Make Prompt for Google Scholar' do
    skip('Ignoring all tests in ExperimentWithBulkInsertTest') if @@skip_tests
    WebMock.allow_net_connect!
  
    RubyLLM.configure do |config|
      config.openai_api_key = ENV['OPENAI_API_KEY']
    end
    
    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.with_tools(DownloadPage)
    
    chat.ask "What is the title of the web page https://www.nike.com/w?q=shirts%20without%20stripes" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    chat.ask "Can you print out the search query that was used to fetch the page?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    chat.ask "Can you print out how many total results were found?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    chat.ask "Can you print out how many individual results were returned in the current page?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    puts "BREAK"
    chat.ask "For each individual result, can you print out the result in JSON format?  Please include the date, description, any url" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    
    puts "AWESOME"
    chat.ask "Can you generate the JavaScript required to take the raw HTML and convert it to the JSON format you previously used?" do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end    
    
  end

end
