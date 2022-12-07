# == Schema Information
#
# Table name: query_doc_pairs
#
#  id              :bigint           not null, primary key
#  document_fields :text(65535)
#  position        :integer
#  query_text      :string(255)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  book_id         :bigint           not null
#  doc_id          :string(255)
#  user_id         :integer
#
# Indexes
#
#  index_query_doc_pairs_on_book_id  (book_id)
#
# Foreign Keys
#
#  fk_rails_...  (book_id => books.id)
#
require "test_helper"

class QueryDocPairTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
