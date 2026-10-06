# frozen_string_literal: true

class RatingsController < ApplicationController
  include Pagy::Method

  before_action :set_case

  # GET /ratings or /ratings.json
  def index
    # The free-text box is params[:search], a separate top-level param from
    # Ransack's own q[...] hash (which sort_link's q[s]=... links now own) -
    # it can't bind to a single Ransack attribute name like search_endpoints'
    # did, since m: 'or' here combines three *different* predicates (two
    # _cont plus one _eq), not one attribute grouped with itself.
    ransack_params = params[:q].present? ? params[:q].to_unsafe_h : {}
    if params[:search].present?
      term = params[:search].to_s
      ransack_params[:m] = 'or'
      ransack_params[:query_query_text_cont] = term
      ransack_params[:doc_id_cont] = term
      ransack_params[:rating_eq] = term.to_f
    end

    @q = @case.ratings.includes([ :query, :user ]).ransack(ransack_params)
    @q.sorts = 'updated_at asc' if @q.sorts.empty?

    @pagy, @ratings = pagy(@q.result)
  end
end
