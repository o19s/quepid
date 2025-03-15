# frozen_string_literal: true

# == Schema Information
#
# Table name: query_doc_pairs
#
#  id               :bigint           not null, primary key
#  document_fields  :text(16777215)
#  information_need :string(255)
#  notes            :text(65535)
#  options          :json
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
class QueryDocPair < ApplicationRecord
  belongs_to :book
  has_many :judgements, dependent: :destroy, autosave: true

  validates :query_text, presence: true, length: { maximum: 2048 }
  validates :doc_id, presence: true
  validates :position, numericality: { only_integer: true }, allow_nil: true
  validates :document_fields, presence: true, json: true, allow_nil: true
  validates :options, json: true

  scope :has_judgements, -> { joins(:judgements) }
end
