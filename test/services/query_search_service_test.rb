# frozen_string_literal: true

require 'test_helper'

class QuerySearchServiceTest < ActiveSupport::TestCase
  let(:service) { QuerySearchService.new }

  describe 'execute with nil search_endpoint' do
    it 'returns error hash when try has no search endpoint' do
      atry = tries(:for_case_no_queries_try_1)
      query = queries(:one)

      # Fixture may or may not have endpoint; ensure nil for this test
      atry.update_column(:search_endpoint_id, nil) if atry.search_endpoint.present?

      result = service.execute(atry, query)

      assert result.key?(:error), 'Expected error key in result'
      assert result.key?(:response_status), 'Expected response_status key in result'
      assert_equal 400, result[:response_status]
      assert_includes result[:error], 'No search endpoint defined'
    end
  end
end
