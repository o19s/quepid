# frozen_string_literal: true

class RatingsController < ApplicationController
  include Pagy::Method

  before_action :set_case

  # GET /ratings or /ratings.json
  def index
    query = @case.ratings.includes([ :query, :user ])

    if params[:q].present?
      q = "%#{params[:q].to_s.downcase}%"
      query = query.where('LOWER(query_text) LIKE ? OR LOWER(doc_id) LIKE ? OR rating = ?',
                          q, q, params[:q].to_f)
    end

    @pagy, @ratings = pagy(query.order(:updated_at))
  end
end
