# frozen_string_literal: true

require 'test_helper'

class RatingDocumentsFlowTest < ActionDispatch::IntegrationTest
  it 'can rate documents where the doc_id isnt in the route' do
    assert_routing(
      {
        method: 'put',
        path:   '/api/cases/44/queries/62/ratings',
      },
      controller: 'api/v1/queries/ratings',
      action:     'update',
      format:     :json,
      case_id:    '44',
      query_id:   '62'
    )
  end
end
