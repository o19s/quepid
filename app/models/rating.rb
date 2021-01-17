# frozen_string_literal: true

# == Schema Information
#
# Table name: ratings
#
#  id         :integer          not null, primary key
#  doc_id     :string(500)
#  rating     :integer
#  query_id   :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class Rating < ApplicationRecord
  belongs_to :query

  # arguably we shouldn't need this, however today you can have a rating object that doesn't have a
  # value set.  fully_rated means that the rating integer has been set.
  scope :fully_rated, -> { where.not(rating: nil) }
end
