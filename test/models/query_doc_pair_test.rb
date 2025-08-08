# frozen_string_literal: true

require 'test_helper'

class QueryDocPairTest < ActiveSupport::TestCase
  describe 'emoji support' do
    test 'handles emoji in document_fields' do
      query_doc_pair = QueryDocPair.create document_fields: '👍 👎 💩'

      assert_equal query_doc_pair.document_fields, '👍 👎 💩'
    end
  end
end
