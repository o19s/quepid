# frozen_string_literal: true

class RatingsController < ApplicationController
  include Pagy::Method

  before_action :set_case

  # GET /ratings or /ratings.json
  def index
    query = @case.ratings.includes([ :query, :user ])

    if params[:q].present?
      q = "%#{params[:q].to_s.downcase}%"
      rating = Float(params[:q].to_s.strip, exception: false)

      # Only compare the rating column for numeric terms; String#to_f would turn any text into 0.0
      # and match every rating of 0.
      query = if rating
                query.where('LOWER(query_text) LIKE ? OR LOWER(doc_id) LIKE ? OR rating = ?', q, q, rating)
              else
                query.where('LOWER(query_text) LIKE ? OR LOWER(doc_id) LIKE ?', q, q)
              end
    end

    @pagy, @ratings = pagy(query.order(:updated_at))
  end
end
