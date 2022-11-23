# == Schema Information
#
# Table name: query_doc_pairs
#
#  id              :bigint           not null, primary key
#  document_fields :text(65535)
#  query_text      :string(255)
#  rank            :float(24)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  book_id         :bigint           not null
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
class QueryDocPair < ApplicationRecord
  belongs_to :book
end
