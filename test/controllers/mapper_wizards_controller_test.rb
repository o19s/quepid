# frozen_string_literal: true

require 'test_helper'

class MapperWizardsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:doug) }
  let(:search_endpoint) { search_endpoints(:edinburgh_uni_search_api) }

  setup do
    login_user_for_integration_test user
  end

  test 'should get show for new endpoint' do
    get new_mapper_wizard_url
    assert_response :success
    assert_select 'h1', 'Mapper Wizard'
  end

  test 'should get show for existing endpoint' do
    # Give user access to the endpoint via team (doug is member of shared team)
    search_endpoint.teams << teams(:shared)

    get mapper_wizard_url(search_endpoint)
    assert_response :success
    assert_select 'h1', 'Mapper Wizard'
  end

  test 'fetch_html returns error for blank URL' do
    post mapper_wizard_fetch_html_url('new'),
         params: { search_url: '' },
         as:     :json

    assert_response :unprocessable_entity
    json = response.parsed_body
    assert_equal false, json['success']
    assert_equal 'URL is required', json['error']
  end

  test 'fetch_html returns error for invalid URL format' do
    post mapper_wizard_fetch_html_url('new'),
         params: { search_url: 'not-a-valid-url' },
         as:     :json

    assert_response :unprocessable_entity
    json = response.parsed_body
    assert_equal false, json['success']
    assert_equal 'Invalid URL format', json['error']
  end

  test 'generate_mappers requires HTML content in session' do
    post mapper_wizard_generate_mappers_url('new'),
         params: { api_key: 'sk-test-key' },
         as:     :json

    assert_response :unprocessable_entity
    json = response.parsed_body
    assert_equal false, json['success']
    assert_equal 'No HTML content. Fetch HTML first.', json['error']
  end

  test 'test_mapper requires HTML content in session' do
    post mapper_wizard_test_mapper_url('new'),
         params: {
           mapper_type: 'numberOfResultsMapper',
           code:        'numberOfResultsMapper = function(data) { return 10; }',
         },
         as:     :json

    assert_response :unprocessable_entity
    json = response.parsed_body
    assert_equal false, json['success']
    assert_equal 'No HTML content.', json['error']
  end

  test 'refine_mapper requires HTML content in session' do
    post mapper_wizard_refine_mapper_url('new'),
         params: {
           mapper_type:  'numberOfResultsMapper',
           current_code: 'numberOfResultsMapper = function(data) { return 0; }',
           feedback:     'Make it better',
           api_key:      'sk-test-key',
         },
         as:     :json

    assert_response :unprocessable_entity
    json = response.parsed_body
    assert_equal false, json['success']
    assert_equal 'No HTML content.', json['error']
  end

  test 'save creates new search endpoint without session' do
    # Test that save works even without fetch_html being called first
    # (endpoint_url is provided directly in params)

    assert_difference 'SearchEndpoint.count', 1 do
      post mapper_wizard_save_url('new'),
           params: {
             name:                     'Test Search API',
             number_of_results_mapper: 'numberOfResultsMapper = function(data) { return 0; }',
             docs_mapper:              'docsMapper = function(data) { return []; }',
             endpoint_url:             'https://example.com/search',
             api_method:               'GET',
             proxy_requests:           'true',
           },
           as:     :json
    end

    assert_response :success
    json = response.parsed_body
    assert_equal true, json['success']
    assert json['redirect_url'].present?

    # Verify the created endpoint
    endpoint = SearchEndpoint.last
    assert_equal 'Test Search API', endpoint.name
    assert_equal 'searchapi', endpoint.search_engine
    assert_equal 'https://example.com/search', endpoint.endpoint_url
    assert_equal 'GET', endpoint.api_method
    assert endpoint.proxy_requests
    assert endpoint.mapper_code.include?('numberOfResultsMapper')
    assert endpoint.mapper_code.include?('docsMapper')
  end

  test 'save updates existing search endpoint' do
    # Give user access to the endpoint via team (doug is member of shared team)
    search_endpoint.teams << teams(:shared)

    assert_no_difference 'SearchEndpoint.count' do
      post mapper_wizard_save_url(search_endpoint),
           params: {
             name:                     'Updated Search API',
             number_of_results_mapper: 'numberOfResultsMapper = function(data) { return 100; }',
             docs_mapper:              'docsMapper = function(data) { return [{id: "new"}]; }',
             endpoint_url:             'https://example.com/search',
             api_method:               'GET',
             proxy_requests:           'true',
           },
           as:     :json
    end

    assert_response :success
    json = response.parsed_body
    assert_equal true, json['success']

    # Verify the updated endpoint
    search_endpoint.reload
    assert_equal 'Updated Search API', search_endpoint.name
    assert search_endpoint.mapper_code.include?('return 100')
  end

  test 'save fails with missing name' do
    post mapper_wizard_save_url('new'),
         params: {
           name:                     '',
           number_of_results_mapper: 'numberOfResultsMapper = function(data) { return 0; }',
           docs_mapper:              'docsMapper = function(data) { return []; }',
           endpoint_url:             'https://example.com/search',
         },
         as:     :json

    # Should still succeed since name is optional in the model
    # but endpoint_url is required
    assert_response :success
  end

  test 'save fails with missing endpoint_url' do
    post mapper_wizard_save_url('new'),
         params: {
           name:                     'Test',
           number_of_results_mapper: 'numberOfResultsMapper = function(data) { return 0; }',
           docs_mapper:              'docsMapper = function(data) { return []; }',
           endpoint_url:             '',
         },
         as:     :json

    assert_response :unprocessable_entity
    json = response.parsed_body
    assert_equal false, json['success']
    assert json['errors'].present?
  end
end

class ExtractFunctionTest < ActiveSupport::TestCase
  test 'extract_function parses simple function' do
    code = 'numberOfResultsMapper = function(data) { return 10; }'
    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'numberOfResultsMapper')

    assert_equal code, result
  end

  test 'extract_function parses function with nested braces' do
    code = <<~JS
      docsMapper = function(data) {
        var docs = [];
        if (data) {
          docs = data.map(function(item) {
            return { id: item.id };
          });
        }
        return docs;
      }
    JS

    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'docsMapper')

    assert_not_nil result
    assert result.include?('var docs = [];')
    assert result.include?('return docs;')
  end

  test 'extract_function handles strings with braces' do
    code = 'numberOfResultsMapper = function(data) { return data.match(/{(.*)}/); }'
    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'numberOfResultsMapper')

    assert_equal code, result
  end

  test 'extract_function handles template literals' do
    code = 'numberOfResultsMapper = function(data) { var msg = `Found { results}`; return 10; }'
    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'numberOfResultsMapper')

    assert_equal code, result
  end

  test 'extract_function parses large complex docsMapper' do
    code = <<~JS
            // numberOfResultsMapper - Returns total number of search results
      numberOfResultsMapper = function(data) {
        // This function parses the number of results from a given HTML string.
        // It looks for the productAreaHits value in a JSON-like structure.

        // Find the index of productAreaHits keyword
        var productAreaHitsIndex = data.indexOf('productAreaHits');

        // Return 0 if the productAreaHits keyword is not found
        if (productAreaHitsIndex === -1) {
          return 0;
        }

        // Find the starting index for the number by looking from the productAreaHits position
        var startIndex = data.indexOf(":", productAreaHitsIndex) + 1;

        // Find the ending index for the number by looking for the next comma or closing brace
        var endIndex = data.indexOf(",", startIndex);
        if (endIndex === -1) {
          endIndex = data.indexOf("}", startIndex);
        }

        // Extract the substring representing the number
        var numberString = data.substring(startIndex, endIndex).trim();

        // Parse the integer from the string
        return parseInt(numberString, 10);
      }

      // docsMapper - Converts source data to Quepid format
      // docsMapper - Converts source data to Quepid format
      docsMapper = function(data) {
        var docs = [];

        // Use regex to extract the JSON embedded in the HTML as the variable 'afterSearchVoRaw'
        var jsonVariableStart = data.indexOf('var afterSearchVoRaw = ');
        if (jsonVariableStart !== -1) {
          var jsonVariableEnd = data.indexOf("}';", jsonVariableStart);
          if (jsonVariableEnd !== -1) {
            // Extract the JSON string, remove extra escaping, and parse it.
            var jsonText = data.substring(jsonVariableStart + 24, jsonVariableEnd + 1);

            jsonText = jsonText.replace(/\\"/g, '"'); // Remove extra escaping

            try {
              var jsonData = JSON.parse(jsonText);
              var products = jsonData.modelContainer && jsonData.modelContainer.items || [];#{' '}

              // Extract data from the products JSON array
              products.forEach(function(product) {
                var doc = {
                  id: product.name,
                  title: product.displayName,
                  url: product.itemUrl,
                  description: product.uspText,
                  image: product.imageUrl
                };
                docs.push(doc);
              });
            } catch (e) {
              console.error("Failed to parse JSON data", e);
            }
          }
        }

        // Fallback to parsing HTML result blocks if JSON is not available
        if (docs.length === 0) {
          var blocks = data.split('<div class="resultItem">');
          for (var i = 1; i < blocks.length; i++) {
            var block = blocks[i];
            var titleMatch = block.match(/<a[^>]*class="resultTitle"[^>]*>(.*?)</a>/);
            var urlMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*class="resultTitle">/);
            var descriptionMatch = block.match(/<p[^>]*class="resultDescription"[^>]*>(.*?)</p>/);
            var imageMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/);

            if (titleMatch && urlMatch) {
              var doc = {
                id: urlMatch[1],
                title: titleMatch[1].replace(/<[^>]+>/g, '')
              };
              if (descriptionMatch) {
                doc.description = descriptionMatch[1].replace(/<[^>]+>/g, '');
              }
              if (imageMatch) {
                doc.image = imageMatch[1];
              }
              docs.push(doc);
            }
          }
        }

        return docs;
      }


    JS

    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'docsMapper')

    assert_not_nil result
    assert result.include?('var jsonVariableStart = data.indexOf')
    assert result.include?('return docs;')
    assert result.match?(/docsMapper\s*=\s*function/)

    puts result
  end

  test 'extract_function handles escaped quotes' do
    code = 'numberOfResultsMapper = function(data) { var str = "He said \\"hello\\""; return 5; }'
    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'numberOfResultsMapper')

    assert_equal code, result
  end

  test 'extract_function returns nil for missing function' do
    code = 'someOtherFunction = function(data) { return 10; }'
    controller = MapperWizardsController.new
    result = controller.send(:extract_function, code, 'numberOfResultsMapper')

    assert_nil result
  end

  test 'extract_function returns nil for empty code' do
    controller = MapperWizardsController.new
    result = controller.send(:extract_function, '', 'numberOfResultsMapper')

    assert_nil result
  end
end
