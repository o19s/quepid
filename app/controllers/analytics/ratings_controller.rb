# frozen_string_literal: true

module Analytics
  class RatingsController < ApplicationController
    force_ssl if: :ssl_enabled?
    layout 'account'

    before_action :set_case, only: [ :show ]

    # GET /admin/users/1
    # GET /admin/users/1.json
    def show
      @df = Rover::DataFrame.new(@case.ratings)
      @df.delete('updated_at')
      @df.delete('created_at')

      # @df.sort_by! { | r | r[:query_id]}
      # @user_keys = []
      # @case.ratings.each do |r|
      #  key = r.user.nil? ? 'blank' : r.user_id.to_s
      #  @user_keys << key
      # end
      # @user_keys.uniq!.sort
    end
  end
end
