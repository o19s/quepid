# frozen_string_literal: true

require 'test_helper'

# RubyLLM tools are auto-loaded from app/tools directory

# This file originally prototyped the "agentic" JavaScript-extraction workflow described in
# docs/agentic_javascript_extraction.md: an LLM chat with DownloadPage/JavascriptExtractor/
# MapperTool registered as RubyLLM tools (`chat.with_tools(...)`), autonomously deciding to call
# MapperTool, and retrying up to 3 times with progressively simpler prompts when extraction
# failed. That multi-attempt, tool-calling design was never adopted -- grep the app for
# `with_tools` and you will not find a single call. What actually shipped, in the very same PR
# (#1285, "Use LLM to generate dataMapper Javascript"), is the simpler, deterministic pipeline in
# MapperWizardService: fetch HTML once (DownloadPage, called directly), ask the LLM once to
# generate both mapper functions (plain RubyLLM.chat(...).ask(...), no tool-calling), then let
# the wizard UI run/refine them via MapperWizardService#test_mapper / #refine_mapper. See
# app/services/mapper_wizard_service.rb and app/controllers/mapper_wizards_controller.rb.
#
# The test below now exercises that real, shipped pipeline end to end -- fetch -> generate ->
# execute -- against a stubbed OpenAI response (same `https://api.openai.com/v1/chat/completions`
# endpoint and response shape RubyLLM's OpenAI provider actually posts to and parses; see
# test/support/openai_stubs.rb / test/services/llm_service_test.rb for the same stubbing
# approach against LlmService's direct Faraday client). No live network or API key is needed to
# run it.
class ExperimentWithRubyLlmExtractorTest < ActionDispatch::IntegrationTest
  SEARCH_RESULTS_HTML = <<~HTML
    <html>
      <body>
        <div class="result"><h3><a href="http://example.com/1">First Result</a></h3></div>
        <div class="result"><h3><a href="http://example.com/2">Second Result</a></h3></div>
      </body>
    </html>
  HTML

  GENERATED_NUMBER_OF_RESULTS_MAPPER = <<~JS.strip
    numberOfResultsMapper = function(data) {
      var matches = data.match(/<div class="result">/g);
      return matches ? matches.length : 0;
    }
  JS

  GENERATED_DOCS_MAPPER = <<~JS.strip
    docsMapper = function(data) {
      var docs = [];
      var blocks = data.split('<div class="result">');
      for (var i = 1; i < blocks.length; i++) {
        var block = blocks[i];
        var urlMatch = block.match(/href="([^"]+)"/);
        var titleMatch = block.match(/>([^<]+)<\\/a>/);
        if (urlMatch && titleMatch) {
          docs.push({ id: urlMatch[1], title: titleMatch[1] });
        }
      }
      return docs;
    }
  JS

  test 'html based search page: fetch, generate mapper functions via a stubbed LLM, and execute them' do
    stub_request(:get, 'https://search.example.com/results')
      .to_return(status: 200, body: SEARCH_RESULTS_HTML)

    llm_response_content = <<~MARKDOWN
      Here are the mapper functions, based on the HTML structure:

      ```javascript
      #{GENERATED_NUMBER_OF_RESULTS_MAPPER}
      ```

      ```javascript
      #{GENERATED_DOCS_MAPPER}
      ```
    MARKDOWN

    stub_request(:post, 'https://api.openai.com/v1/chat/completions')
      .with(
        headers: { 'Authorization' => 'Bearer sk-test' },
        body:    /First Result/ # proves the downloaded HTML actually made it into the prompt
      )
      .to_return(
        status:  200,
        body:    { choices: [ { message: { content: llm_response_content } } ] }.to_json,
        headers: { 'Content-Type' => 'application/json' }
      )

    service = MapperWizardService.new(api_key: 'sk-test')

    fetch_result = service.fetch_html('https://search.example.com/results')
    assert fetch_result[:success], "fetch_html failed: #{fetch_result[:error]}"

    generate_result = service.generate_mappers(fetch_result[:html])
    assert generate_result[:success], "generate_mappers failed: #{generate_result[:error]}"
    assert_includes generate_result[:number_of_results_mapper], 'numberOfResultsMapper'
    assert_includes generate_result[:docs_mapper], 'docsMapper'

    count_result = service.test_mapper(
      mapper_type:  'numberOfResultsMapper',
      code:         generate_result[:number_of_results_mapper],
      html_content: fetch_result[:html]
    )
    assert count_result[:success], "test_mapper (count) failed: #{count_result[:error]}"
    assert_equal 2, count_result[:result]

    docs_result = service.test_mapper(
      mapper_type:  'docsMapper',
      code:         generate_result[:docs_mapper],
      html_content: fetch_result[:html]
    )
    assert docs_result[:success], "test_mapper (docs) failed: #{docs_result[:error]}"
    assert_equal 2, docs_result[:result].length
    assert_equal 'http://example.com/1', docs_result[:result][0]['id']
    assert_equal 'First Result', docs_result[:result][0]['title']

    assert_requested(:post, 'https://api.openai.com/v1/chat/completions', times: 1)
  end

  test 'multi-attempt agentic tool-calling retry loop' do
    skip 'Never adopted: this test prototyped chat.with_tools(DownloadPage, JavascriptExtractor, ' \
         'MapperTool) plus an up-to-3-attempts retry loop with progressively simpler prompts, as ' \
         'described in docs/agentic_javascript_extraction.md. The app never wires an LLM chat to ' \
         'those tools via with_tools (grep app/ for with_tools -- zero hits); ' \
         'MapperWizardService#generate_mappers asks the LLM once and returns the result, and any ' \
         'retrying happens through the wizard UI calling #test_mapper / #refine_mapper again, not ' \
         'through an autonomous agent loop. Reviving this would mean the app itself adopting that ' \
         'agentic design first -- there is no current behavior to assert against. The real ' \
         'pipeline this test used to poke at by hand (download -> generate -> execute) is now ' \
         'covered for real, deterministically, in the test above.'
  end
end
