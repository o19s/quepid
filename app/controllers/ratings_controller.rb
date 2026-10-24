# frozen_string_literal: true

class RatingsController < ApplicationController
  include Pagy::Method

  before_action :set_case

  # GET /ratings or /ratings.json
  def index
    query = @case.ratings.includes([ :query, :user ])

    if params[:q].present?
      rating = Float(params[:q].to_s.strip, exception: false)

      # Only compare the rating column for numeric terms; String#to_f would turn any text into 0.0
      # and match every rating of 0.
      matches = query.search_by(params[:q], 'queries.query_text', 'ratings.doc_id')
      query = rating ? matches.or(query.where(rating: rating)) : matches
    end

    @pagy, @ratings = pagy(query.order(:updated_at))
  end
end
