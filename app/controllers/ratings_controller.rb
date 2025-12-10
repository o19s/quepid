# frozen_string_literal: true

class RatingsController < ApplicationController
  include Pagy::Method

  before_action :set_case

  # GET /ratings or /ratings.json
  def index
    query = @case.ratings.includes([ :query, :user ])

    if params[:q].present?
      query = query.where('query_text LIKE ? OR doc_id LIKE ? OR rating LIKE ?',
                          "%#{params[:q]}%", "%#{params[:q]}%", "%#{params[:q]}%")
    end

    @pagy, @ratings = pagy(query.order(:updated_at))
  end
end
