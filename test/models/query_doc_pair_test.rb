# frozen_string_literal: true

# == Schema Information
#
# Table name: query_doc_pairs
#
#  id               :bigint           not null, primary key
#  document_fields  :text(16777215)
#  information_need :string(255)
#  notes            :text(65535)
#  options          :text(65535)
#  position         :integer
#  query_text       :string(2048)
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  book_id          :bigint           not null
#  doc_id           :string(500)
#
# Indexes
#
#  index_query_doc_pairs_on_book_id  (book_id)
#
# Foreign Keys
#
#  fk_rails_...  (book_id => books.id)
#
require 'test_helper'

class QueryDocPairTest < ActiveSupport::TestCase
  describe 'emoji support' do
    test 'handles emoji in document_fields' do
      query_doc_pair = QueryDocPair.create document_fields: '👍 👎 💩'

      assert_equal query_doc_pair.document_fields, '👍 👎 💩'
    end
  end
end
