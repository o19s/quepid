# frozen_string_literal: true

# See https://github.com/ankane/rover for more info.
module Analytics
  class RatingsController < ApplicationController
    force_ssl if: :ssl_enabled?
    layout 'account'

    before_action :set_case, only: [ :show ]

    # GET /admin/users/1
    # GET /admin/users/1.json
    # rubocop:disable Metrics/MethodLength
    def show
      user_ids = @case.ratings.select(:user_id).distinct.map(&:user_id)

      puts "I have #{user_ids} user ids"

      @df = nil
      @usernames = []
      user_ids.each do |user_id|
        username = user_id.nil? ? 'User Unknown' : User.find_by(id: user_id).name
        @usernames << username

        df_for_user = create_df_for_user user_id, username
        @df = if @df.nil?
                df_for_user
              else
                @df.left_join(df_for_user, on: %w[query_id doc_id])
              end
      end

      @df['query_text'] = Array.new(@df.count, '')
      @df.count.to_i.times do |x|
        @df['query_text'][x] = Query.find_by(id: @df['query_id'][x]).query_text
      end

      # puts @df
    end

    # rubocop:enable Metrics/MethodLength
    def create_df_for_user user_id, username
      puts "Found #{@case.ratings.where(user_id: user_id).count} ratings for #{username}"
      df = Rover::DataFrame.new(@case.ratings.where(user_id: user_id))
      df.delete('updated_at')
      df.delete('created_at')
      df.delete('id')
      df.delete('user_id')
      df[username] = df.delete('rating')
      df
    end
  end
end
