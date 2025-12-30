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
    chat = RubyLLM.chat(model: 'gpt-5') # gpt-5 wrote a lot more code and it was better.
    chat.with_tools(DownloadPage, JavascriptExtractor, JavascriptMapper)
    chat.on_tool_call do |tool_call|
      # Called when the AI decides to use a tool
      puts "Calling tool: #{tool_call.name}"
      puts "Arguments: #{tool_call.arguments}"
    end

    chat.ask 'What is the title of the web page https://search.ed.ac.uk/?q=mental' do |chunk|
      # Each chunk contains a portion of the response
      print chunk.content
    end

    # chat.ask 'Can you print out the search query that was used to fetch the page?' do |chunk|
    #   # Each chunk contains a portion of the response
    #   print chunk.content
    # end

    # chat.ask 'Can you print out how many total results were found?' do |chunk|
    #   # Each chunk contains a portion of the response
    #   print chunk.content
    # end

    # chat.ask 'Can you print out how many individual results were returned in the current page?' do |chunk|
    #   # Each chunk contains a portion of the response
    #   print chunk.content
    # end
    # puts "\n\n\nBREAK\n\n\n"
    # chat.ask 'For each individual result, can you print out the result in JSON format?  Please include the date, description, any url' do |chunk|
    #   # Each chunk contains a portion of the response
    #   print chunk.content
    # end

    puts "\n\n\nAWESOME\n\n\n"
    chat.with_instructions <<~PROMPT, replace: true
      You are a JavaScript expert helping create data extraction functions for Quepid.

        **Requirements:**
        - Generate two JavaScript functions: numberOfResultsMapper and docsMapper#{'  '}
        - Define functions as: functionName = function(params) {} (not function functionName())
        - Include brief comments explaining logic
        - Wrap ALL JavaScript code in ```javascript code blocks
        - Target V8 engine only (no DOM APIs)

        **Function Specifications:**
      #{'   '}
         numberOfResultsMapper: Returns total number of search results found
         ```javascript#{'         '}
         numberOfResultsMapper = function(data){
           return data.length;
         }
      #{'   '}
         docsMapper: Converts source data format to the JSON format that Quepid format expects required "id" and "title" keys.
         Include additional attributes like "description", "url", "image" only if they exist for most results.
         Use URL as fallback "id" if no obvious "id" field exists.
         ```javascript
         docsMapper = function(data){
             let docs = [];
             for (let doc of data) {
               docs.push({
                 id: doc.publication_id,
                 title: doc.title,
               });
             }
             return docs;
           }
          ```
         Analyze the downloaded HTML structure first, then generate appropriate functions.
    PROMPT

    response = chat.ask 'Can you generate the JavaScript methods required to convert the raw HTML that was downloaded into the formats that Quepid requires?'

    puts response.content

    puts "\n\n\NOW WE ARE GETTING SOMEWHERE\n\n\n"
    # chat.ask 'Can you give me just the JavaScript code I need?' do |chunk|
    #   # Each chunk contains a portion of the response
    #   print chunk.content
    # end
    response = chat.ask 'Can you give me just the JavaScript code I need?'
    puts response.content

    # pp response
    #
    # Implement agentic workflow with retry logic
    max_attempts = 3
    attempt = 1
    extraction_successful = false

    while attempt <= max_attempts && !extraction_successful
      puts "\nATTEMPT #{attempt}/#{max_attempts}: Trying JavaScript extraction..."

      if 1 == attempt
        response = chat.ask 'Can you use the JavascriptMapper tool with the Javascript code you created and the HTML content that was downloaded to parse out the number of results and document data?'
      elsif 2 == attempt
        puts "\nFirst attempt may have failed. Let's try a simpler approach..."
        response = chat.ask <<~RETRY_PROMPT
          The previous JavaScript extraction may not have worked properly. Let's try again with a simpler approach:

          1. First, use the JavascriptMapper tool to test your current JavaScript functions
          2. If the results show 0 documents or 0 total results, create simpler JavaScript functions that use basic string operations instead of complex regex
          3. Focus on finding obvious patterns in the HTML like repeated div classes or common HTML structures
          4. Use indexOf, substring, and split methods instead of complex regex patterns

          Please try the JavascriptMapper tool again with either your current functions or improved simpler ones.
        RETRY_PROMPT
      else
        puts "\nFinal attempt: Debugging the extraction..."
        response = chat.ask <<~DEBUG_PROMPT
          Let's debug why the extraction isn't working:

          1. Use the JavascriptMapper tool with very simple test functions first:
             - numberOfResultsMapper that just returns 5 (hardcoded)
             - docsMapper that returns a simple test array like [{id: "test", title: "Test Document"}]
          2. If that works, then gradually make the functions more sophisticated
          3. Look for the most obvious repeating pattern in the HTML (like div tags with consistent classes)
          4. Use only basic string operations: indexOf, substring, split - no regex

          Try the JavascriptMapper tool with either simple test functions or your best attempt at parsing.
        DEBUG_PROMPT
      end

      puts response.content

      # Check if the extraction was successful by looking for JavascriptMapper tool usage indicators
      if response.content.include?('JAVASCRIPT MAPPER TOOL COMPLETED SUCCESSFULLY')

        # Parse the results to check if we got meaningful data using simple string operations
        doc_count = 0
        total_results = 0

        # Look for the document count line
        response.content.each_line do |line|
          if line.include?('Documents extracted:')
            doc_match = line.match(/(\d+)/)
            doc_count = doc_match[1].to_i if doc_match
          elsif line.include?('Total results counted:')
            results_match = line.match(/(\d+)/)
            total_results = results_match[1].to_i if results_match
          end
        end

        puts "\nEXTRACTION RESULTS: #{doc_count} documents, #{total_results} total results"

        # Consider successful if we got some reasonable results
        if doc_count.positive? || total_results.positive?
          extraction_successful = true
          puts "SUCCESS: JavaScript extraction worked on attempt #{attempt}!"
        else
          puts 'Got 0 results - will retry with different approach...'
        end
      elsif response.content.include?('JAVASCRIPT MAPPER TOOL FAILED')
        puts 'JavascriptMapper tool failed - will retry with different approach...'
      else
        puts 'No clear JavascriptMapper tool usage detected - checking response content...'
        # If the response contains parsed results even without explicit tool markers, consider it successful
        if response.content.match(/(\d+)\s+(documents?|results?)/i) &&
           !response.content.match(/0\s+(documents?|results?)/i)
          extraction_successful = true
          puts 'SUCCESS: Found evidence of successful extraction in response!'
        end
      end

      unless extraction_successful
        attempt += 1
        puts "\nAttempt #{attempt - 1} incomplete. #{max_attempts - attempt + 1} attempts remaining..." if attempt <= max_attempts
      end
    end

    if extraction_successful
      puts "\nFINAL SUCCESS: JavaScript extraction completed successfully!"
    else
      puts "\nEXTRACTION INCOMPLETE: After #{max_attempts} attempts, extraction may not have worked optimally."
      puts 'However, the LLM may have provided useful information or fallback analysis.'
    end
  end
end
