# frozen_string_literal: true

require 'test_helper'
require 'benchmark'
require 'nokogiri'

require 'tzinfo'

class DownloadPage < RubyLLM::Tool
  description 'Downloads a specific web search results page'
  param :url, desc: 'Webpage Search Results URL (e.g., https://search.ed.ac.uk/?q=mental)'

  def execute url:
    # url = "https://api.open-meteo.com/v1/forecast?latitude=#{latitude}&longitude=#{longitude}&current=temperature_2m,wind_speed_10m"

    response = Faraday.get(url)
    # data = JSON.parse(response.body)
    data = response.body
    # assuming it's html not json
    clean_html = strip_css_styling(data)
    # puts clean_html
    clean_html
  rescue StandardError => e
    { error: e.message }
  end

  def strip_css_styling html
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
    doc.xpath('//@*[starts-with(name(), "on")]').each(&:remove)
    doc.css('[href^="javascript:"]').each do |el|
      el.remove_attribute('href')                # Remove javascript: URLs
    end

    # Return the cleaned HTML
    doc.to_html
  end
end

class JavaScriptExtractor < RubyLLM::Tool
  description 'Extracts JavaScript code blocks from markdown content'
  param :markdown_content, desc: 'Markdown content string containing JavaScript code blocks'

  def execute markdown_content:
    # Extract JavaScript code blocks using regex
    javascript_blocks = extract_javascript_blocks(markdown_content)
    
    if javascript_blocks.empty?
      { error: "No JavaScript code blocks found in the markdown content" }
    else
      javascript_blocks.join("\n\n")
    end
  rescue StandardError => e
    { error: e.message }
  end

  private

  def extract_javascript_blocks(content)
    # Match code blocks that are either ```javascript or just ```
    # This regex captures the content between the backticks
    javascript_blocks = []
    
    # Match ```javascript ... ``` blocks
    content.scan(/```javascript\n(.*?)\n```/m) do |match|
      javascript_blocks << match[0].strip
    end
    
    # Match ```js ... ``` blocks  
    content.scan(/```js\n(.*?)\n```/m) do |match|
      javascript_blocks << match[0].strip
    end
    
    # If no labeled blocks found, try unlabeled ``` blocks that contain JavaScript-like content
    if javascript_blocks.empty?
      content.scan(/```\n(.*?)\n```/m) do |match|
        code = match[0].strip
        # Simple heuristic: if it contains function, const, let, var, or =>, it's likely JavaScript
        if code.match?(/(function|const |let |var |=>|\{|\})/)
          javascript_blocks << code
        end
      end
    end
    
    javascript_blocks
  end
end

class ExperimentWithRubyLlmExtractorTest < ActionDispatch::IntegrationTest
  let(:user) { users(:doug) }
  let(:scorer) { scorers(:quepid_default_scorer) }
  let(:selection_strategy) { selection_strategies(:multiple_raters) }

  # rubocop:disable Style/ClassVars
  @@skip_tests = false
  # rubocop:enable Style/ClassVars


  test 'download page' do
    skip('Ignoring all tests in ExperimentWithRubyLlmExtractorTest') if @@skip_tests
    WebMock.allow_net_connect!

    RubyLLM.configure do |config|
      config.openai_api_key = ENV.fetch('OPENAI_API_KEY', nil)
    end

    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.with_tools(DownloadPage, JavaScriptExtractor)

    chat.ask 'What is the title of the web page https://search.ed.ac.uk/?q=mental' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    chat.ask 'Can you print out the search query that was used to fetch the page?' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    chat.ask 'Can you print out how many total results were found?' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    chat.ask 'Can you print out how many individual results were returned in the current page?' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    puts "\n\n\nBREAK\n\n\n"
    chat.ask 'For each individual result, can you print out the result in JSON format?  Please include the date, description, any url' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    puts "\n\n\nAWESOME\n\n\n"
    chat.with_instructions <<~PROMPT, replace: true
      You are a helpful JavaScript expert.
      
      When generating code, always:
      - Use modern JavaScript syntax
      - Include helpful comments
      - Provide working examples
      - Wrap ALL JavaScript code in ```javascript code blocks
      - Provide explanation text outside of code blocks
      - Keep it very simple, we only want JavaScript that would execute in the V8 engine
      - There is no DOMParser available to use
      
     We want to generate these JavaScript methods:
      - numberOfResultsMapper which is used to return how many search results were found overall.
      - docsMapper which converts from the source JSON format to what Quepid expects
        docsMapper should return at a minimum an id key and title key.
      
     Here is an example of numberOfResultsMapper:
     
     ```javascript
     numberOfResultsMapper = function(data){
       return data.length
     };
     ```
     
     Here is an example of docsMapper:
     
    ```javascript
    docsMapper = function(data){
      let docs = [];
    
      
      for (let doc of data) {
        docs.push ({
          id: doc.publication_id,
          title: doc.title,
        });
      }
      return docs;
    };
    ```
     
     
    PROMPT

    response = chat.ask 'Can you generate the JavaScript methods required to convert the raw HTML into the formats that Quepid requires?' 
      
    puts response.content
    
    puts "\n\n\NOW WE ARE GETTING SOMEWHERE\n\n\n"
    chat.ask 'Can you give me just the JavaScript code I need?' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
    #pp response
  end

  test 'Make Prompt for Google Scholar' do
    skip("Ignoring all tests in ExperimentWithRubyLlmExtractorTest") if @@skip_tests
    WebMock.allow_net_connect!

    RubyLLM.configure do |config|
      config.openai_api_key = ENV.fetch("OPENAI_API_KEY", nil)
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

  test "extract javascript from markdown" do
    skip("Ignoring all tests in ExperimentWithRubyLlmExtractorTest") if @@skip_tests

    fixture_path = Rails.root.join("test", "fixtures", "files", "llm_generated_response.md")
    markdown_content = File.read(fixture_path)
    
    extractor = JavaScriptExtractor.new
    result = extractor.execute(markdown_content: markdown_content)
  
    if result.is_a?(String)
      puts "Extracted JavaScript:"
      puts result
    else
      puts "Error occurred"
      puts result[:error] if result[:error]
    end
  end

end
