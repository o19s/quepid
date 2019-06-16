# frozen_string_literal: true

require 'test_helper'

class RatingsImporterTest < ActiveSupport::TestCase
  let(:owned_case) { cases(:owned_case) }
  let(:options)    do
    {
      format:         :hash,
      force:          true,
      clear_existing: true,
    }
  end

  describe 'Import ratings' do
    test 'strips white space in values' do
      ratings = [
        { query_text: 'Mexican Food',   doc_id: ' 720784-021190', rating: ' 5' },
        { query_text: 'Mexican Food',   doc_id: ' 843075-031090', rating: ' 6' },
        { query_text: ' Mexican Food ', doc_id: '748785-005680',  rating: ' 2' }
      ]

      ratings_importer = RatingsImporter.new owned_case, ratings, options
      ratings_importer.import
      rating = Rating.find_by(doc_id: '843075-031090')

      assert_not_nil(rating)
      assert_equal 'Mexican Food', rating.query.query_text
    end
  end
end
