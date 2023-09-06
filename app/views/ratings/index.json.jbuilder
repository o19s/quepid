# frozen_string_literal: true

json.array! @ratings, partial: 'ratings/rating', as: :rating
