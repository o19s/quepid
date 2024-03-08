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
#  index_ratings_on_doc_id  (doc_id)
#  query_id                 (query_id)
#
# Foreign Keys
#
#  ratings_ibfk_1  (query_id => queries.id)
#

class Rating < ApplicationRecord
  belongs_to :query, touch: true
  belongs_to :user, optional: true

  # arguably we shouldn't need this, however today you can have a rating object that doesn't have a
  # value set.  fully_rated means that the rating integer has been set.
  scope :fully_rated, -> { where.not(rating: nil) }
end
