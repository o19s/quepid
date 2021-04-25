# frozen_string_literal: true

module Analytics
  class RatingsController < ApplicationController
    force_ssl if: :ssl_enabled?
    layout 'account'

    before_action :set_case, only: [ :show ]

    # GET /admin/users/1
    # GET /admin/users/1.json
    # rubocop:disable Metrics/MethodLength
    # rubocop:disable Metrics/AbcSize
    def show
      ratings = @case.ratings
      users = []
      ratings.each do |rating|
        rating.rating = -1 if rating.rating.nil?
        puts "rating user: #{rating.user_id}"
        users << rating.user.id unless rating.user.nil?
      end
      @df = Rover::DataFrame.new(ratings)
      @df.delete('updated_at')
      @df.delete('created_at')

      puts @df.keys

      users.uniq!

      puts 'here are users'
      puts users

      df1 = Rover::DataFrame.new(@case.ratings.where('`ratings`.`user_id` = ?', users.first))
      df2 = Rover::DataFrame.new(@case.ratings.where('`ratings`.`user_id` = ?', users.second))

      df1.delete('updated_at')
      df1.delete('created_at')
      df1["user_#{users.first}"] = df1.delete('user_id')
      df1["rating_#{users.first}"] = df1.delete('rating')

      df2.delete('updated_at')
      df2.delete('created_at')
      df2["user_#{users.second}"] = df2.delete('user_id')
      df2["rating_#{users.second}"] = df2.delete('rating')
      puts df1.to_csv
      puts df2.to_csv

      df1 = df1.inner_join(df2, on: %w[query_id doc_id])

      puts 'JOINED'
      puts df1.to_csv

      puts 'Average'
      df1['average'] = (df1["rating_#{users.first}"] * df1["rating_#{users.second}"]) / 2
      puts df1.to_csv
      # @df['rating'][@df['rating'] == nil] = -1

      # puts @df['doc_id'].crosstab(@df['rating'])

      # @df.sort_by! { | r | r[:query_id]}
      # @user_keys = []
      # @case.ratings.each do |r|
      #  key = r.user.nil? ? 'blank' : r.user_id.to_s
      #  @user_keys << key
      # end
      # @user_keys.uniq!.sort
    end
    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Metrics/AbcSize
  end
end
