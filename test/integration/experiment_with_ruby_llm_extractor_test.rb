# frozen_string_literal: true

require 'test_helper'
require 'benchmark'
require 'nokogiri'

require 'tzinfo'

# RubyLLM tools are auto-loaded from app/tools directory

class ExperimentWithRubyLlmExtractorTest < ActionDispatch::IntegrationTest
  let(:user) { users(:doug) }
  let(:scorer) { scorers(:quepid_default_scorer) }
  let(:selection_strategy) { selection_strategies(:multiple_raters) }

  # rubocop:disable Style/ClassVars
  @@skip_tests = ENV.fetch('OPENAI_API_KEY', nil).nil?
  # rubocop:enable Style/ClassVars

  test 'html based search page' do
    skip('Ignoring all tests in ExperimentWithRubyLlmExtractorTest') if @@skip_tests
    assert true
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
      #{'  '}
        When generating code, always:
        - Use modern JavaScript syntax
        - Include helpful comments
        - Provide working examples
        - Wrap ALL JavaScript code in ```javascript code blocks
        - Provide explanation text outside of code blocks
        - Keep it very simple, we only want JavaScript that would execute in the V8 engine
        - There is no DOMParser available to use
      #{'  '}
       We want to generate these JavaScript methods:
        - numberOfResultsMapper which is used to return how many search results were found overall.
        - docsMapper which converts from the source JSON format to what Quepid expects
          docsMapper should return at a minimum an id key and title key.
      #{'  '}
       Here is an example of numberOfResultsMapper:
      #{' '}
       ```javascript
       numberOfResultsMapper = function(data){
         return data.length
       };
       ```
      #{' '}
       Here is an example of docsMapper:
      #{' '}
      ```javascript
      docsMapper = function(data){
        let docs = [];

      #{'  '}
        for (let doc of data) {
          docs.push ({
            id: doc.publication_id,
            title: doc.title,
          });
        }
        return docs;
      };
      ```
      #{' '}
      #{' '}
    PROMPT

    response = chat.ask 'Can you generate the JavaScript methods required to convert the raw HTML into the formats that Quepid requires?'

    puts response.content

    puts "\n\n\NOW WE ARE GETTING SOMEWHERE\n\n\n"
    # chat.ask 'Can you give me just the JavaScript code I need?' do |chunk|
    #   # Each chunk contains a portion of the response
    #   print chunk.content
    # end
    response = chat.ask 'Can you give me just the JavaScript code I need?'
    puts response.content

    # pp response
  end

  test 'Make Prompt for Nike' do
    assert true
    skip('Ignoring all tests in ExperimentWithRubyLlmExtractorTest') if @@skip_tests
    WebMock.allow_net_connect!

    RubyLLM.configure do |config|
      config.openai_api_key = ENV.fetch('OPENAI_API_KEY', nil)
    end

    # Start a chat with the default model (GPT-4o-mini)
    chat = RubyLLM.chat
    chat.with_tools(DownloadPage)

    chat.ask 'What is the title of the web page https://www.nike.com/w?q=shirts%20without%20stripes' do |chunk|
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
    puts 'BREAK'
    chat.ask 'For each individual result, can you print out the result in JSON format?  Please include the date, description, any url' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    puts 'AWESOME'
    chat.ask 'Can you generate the JavaScript required to take the raw HTML and convert it to the JSON format you previously used?' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end
  end

  # Test removed - see tools_test.rb for working JavaScript extractor tests
end
