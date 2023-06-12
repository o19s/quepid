# frozen_string_literal: true

# == Schema Information
#
# Table name: query_doc_pairs
#
#  id              :bigint           not null, primary key
#  document_fields :text(65535)
#  position        :integer
#  query_text      :string(500)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  book_id         :bigint           not null
#  doc_id          :string(500)
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
  has_many :judgements, dependent: :destroy

  validates :query_text, presence: true
  validates :doc_id, presence: true
  validates :position, numericality: { only_integer: true }, allow_nil: true

  scope :has_judgements, -> { joins(:judgements) }
end
