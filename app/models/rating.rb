# frozen_string_literal: true

# == Schema Information
#
# Table name: ratings
#
#  id         :integer          not null, primary key
#  rating     :float(24)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  doc_id     :string(500)
#  query_id   :integer
#  user_id    :integer
#
# Indexes
#
#  index_ratings_on_doc_id    (doc_id)
#  index_ratings_on_query_id  (query_id)
#
# Foreign Keys
#
#  ratings_ibfk_1  (query_id => queries.id)
#

class Rating < ApplicationRecord
  belongs_to :query
  belongs_to :user, optional: true

  # arguably we shouldn't need this, however today you can have a rating object that doesn't have a
  # value set.  fully_rated means that the rating integer has been set.
  scope :fully_rated, -> { where.not(rating: nil) }

  # Ransack (used by RatingsController#index's search box and sortable
  # column headers) - the query association is needed for query_query_text_cont
  # to actually JOIN to queries.query_text (the old hand-written raw SQL
  # referenced that column with no join at all - see the controller).
  def self.ransackable_attributes _auth_object = nil
    %w[doc_id rating created_at updated_at]
  end

  def self.ransackable_associations _auth_object = nil
    %w[query]
  end
end
