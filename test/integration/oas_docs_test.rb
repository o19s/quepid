# frozen_string_literal: true

require 'test_helper'

class OasDocsTest < ActionDispatch::IntegrationTest
  test 'generates an OpenAPI document' do
    host! 'localhost'

    get '/api/docs.json'

    assert_response :success
    specification = response.parsed_body
    assert_predicate specification['openapi'], :present?
    assert_predicate specification['paths'], :present?
  end
end
