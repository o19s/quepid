# frozen_string_literal: true

# See https://github.com/ankane/rover for more info.
# See https://gist.github.com/mamantoha/9c0aec7958c7636cebef for ideas
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
      @case_analytics_manager = CaseAnalyticsManager.new @case

      user_ids = @case.ratings.select(:user_id).distinct.map(&:user_id)

      # We need all the unique query/doc pairs to set up the overall dataframe, then we fill in per user their data.
      query_doc_pairs = @case.ratings.select(:query_id, :doc_id).distinct.map do |r|
        { "querydoc_id": "#{r.query_id}!#{r.doc_id}" }
      end

      @df = Rover::DataFrame.new(query_doc_pairs)
      @usernames = []
      user_ids.each do |user_id|
        username = user_id.nil? ? 'User Unknown' : User.find_by(id: user_id).name
        @usernames << username

        df_for_user = create_df_for_user user_id, username
        @df = if @df.nil?
                df_for_user
              else
                @df.left_join(df_for_user, on: :querydoc_id)
              end
      end

      @df['query_text'] = Array.new(@df.count, '')
      @df['query_mean'] = Array.new(@df.count, '')
      @df['query_doc_rating_variance'] = Array.new(@df.count, '')

      query_doc_ratings_variance_array = []
      @df.count.to_i.times do |x|
        query = Query.find_by(id: @df['query_id'][x])
        @df['query_text'][x] = query.query_text
        query_doc_ratings = query.ratings.where(query_id: @df['query_id'][x], doc_id: @df['doc_id'][x])
        @df['query_doc_rating_variance'][x] = @case_analytics_manager.query_doc_ratings_variance(query_doc_ratings)

        #query_doc_ratings_variance_array << @df['query_doc_rating_variance'][x]
        #@df['query_rating_variance'][x] = @case_analytics_manager.query_ratings_variance(query_doc_ratings_variance_array)
      end

      #@df.group('query_text').mean('query_doc_rating_variance').each |x|
      #  @df['query_mean'] = x
      #end


      # We should sort the @df so when you reload you get same results!
      @df = @df.sort_by! { |r| r['querydoc_id'] }


      @df2 = Rover::DataFrame.new(@case.queries.select(:query_text).distinct)
      @df2['query_mean'] = Array.new(@df2.count, '')
      @df2['variance'] = Array.new(@df2.count, '')
      @df2['variance_size'] = Array.new(@df2.count, '')
      @df2['key_length'] = Array.new(@df2.count, '')
      @df2.count.to_i.times do |x|
        query = Query.find_by(query_text: @df['query_text'][x])
        ratings_by_doc_id = Query.group_by_doc_id_version_two(query.ratings)
        variances = []
        ratings_by_doc_id.each do |key, ratings|
          rating_values = ratings.map(&:rating)
          variances << @case_analytics_manager.variance(rating_values)
        end
        @df2['variance_size'][x] = variances.size
        @df2['variance'][x] = variances.join(',')
        @df2['key_length'][x] = ratings_by_doc_id.keys.join(',')
        @df2['query_mean'][x] = @case_analytics_manager.query_rating_variance_average(variances)

      end

      # puts @df
    end
    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Metrics/AbcSize

    def variance

    end

    def create_df_for_user user_id, username
      df = Rover::DataFrame.new(@case.ratings.where(user_id: user_id))
      df.delete('updated_at')
      df.delete('created_at')
      df.delete('id')
      df.delete('user_id')
      df[username] = df.delete('rating')

      # populate the portion of the data frame that we have query/doc ratings for
      df[:querydoc_id] = Array.new(df.count, '')
      df.count.to_i.times do |x|
        df[:querydoc_id][x] = "#{df['query_id'][x]}!#{df['doc_id'][x]}"
      end
      df
    end
  end
end
