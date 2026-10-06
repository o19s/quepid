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

  # Ransack (used by QueryDocPairsController#index's search box and sortable
  # column headers) - keep this to what's used today.
  def self.ransackable_attributes _auth_object = nil
    %w[id query_text position doc_id document_fields created_at updated_at]
  end

  def self.ransackable_associations _auth_object = nil
    []
  end

  # Serialization
  serialize :document_fields, coder: JSON

  after_initialize do |query_doc_pair|
    # Only set default if the attribute is loaded (handles partial selects)
    query_doc_pair.document_fields ||= {} if query_doc_pair.has_attribute?(:document_fields)
  end

  validates :query_text, presence: true, length: { maximum: 2048 }
  validates :doc_id, presence: true
  validates :position, numericality: { only_integer: true }, allow_nil: true
  validates :document_fields, json_format: true
  validates :options, json_format: true, allow_blank: true

  scope :has_judgements, -> { joins(:judgements) }

  after_create_commit :queue_auto_run_ai_judges

  private

  def queue_auto_run_ai_judges
    book.books_ai_judges.auto_run.find_each do |bai|
      RunJudgeJudyJob.perform_later(book, bai.ai_judge, nil)
    end
  end
end
