# frozen_string_literal: true

class RatingsController < ApplicationController
  before_action :find_case

  # GET /ratings or /ratings.json
  def index
    @ratings = @case.ratings.includes([ :query, :user ]).limit(5000)
  end
end
