# frozen_string_literal: true

# == Schema Information
#
# Table name: judgements
#
#  id                :bigint           not null, primary key
#  rating            :float(24)
#  unrateable        :boolean          default(FALSE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  query_doc_pair_id :bigint           not null
#  user_id           :integer
#
# Indexes
#
#  index_judgements_on_query_doc_pair_id  (query_doc_pair_id)
#
# Foreign Keys
#
#  fk_rails_...  (query_doc_pair_id => query_doc_pairs.id)
#
class Judgement < ApplicationRecord
  belongs_to :query_doc_pair
  belongs_to :user, optional: true

  validates :user_id, :uniqueness => { :scope => :query_doc_pair_id }
  validates :rating,
            presence: true, unless: :unrateable

  scope :rateable, -> { where(unrateable: false) }

  def mark_unrateable
    self.unrateable = true
    self.rating = nil
  end

  def mark_unrateable!
    mark_unrateable
    save
  end
end
