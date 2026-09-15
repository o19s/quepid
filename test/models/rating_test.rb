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

require 'test_helper'

class RatingTest < ActiveSupport::TestCase
  describe 'associations' do
    let(:rating) { ratings(:a_query_rating) }

    test 'belongs to a query' do
      assert_equal queries(:a_query), rating.query
    end

    test 'is not valid without a query' do
      rating = Rating.new doc_id: 'doc1', rating: 3

      assert_not rating.valid?
      assert_includes rating.errors[:query], 'must exist'
    end

    test 'optionally belongs to a user' do
      rating_with_user = ratings(:second_query_rating2)

      assert_equal users(:random), rating_with_user.user
    end

    test 'does not require a user' do
      rating = Rating.new doc_id: 'doc1', rating: 3, query: queries(:a_query)

      assert_predicate rating, :valid?
    end
  end

  describe '.fully_rated' do
    test 'includes ratings that have a rating value set' do
      rated = ratings(:rating_with_rating)

      assert_includes Rating.fully_rated, rated
    end

    test 'excludes ratings without a rating value set' do
      unrated = ratings(:rating_without_rating)

      assert_nil unrated.rating
      assert_not_includes Rating.fully_rated, unrated
    end
  end
end
