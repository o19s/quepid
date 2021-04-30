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
    # rubocop:disable Metrics/AbcSize
    def show


#select distinct q.query_text, r.doc_id from cases c, queries q, ratings r where c.id = 681124819 and c.id = q.case_id and r.query_id = q.id

      sql = "
        SELECT  DISTINCT `queries`.`id`, `ratings`.`doc_id`
        FROM `cases`, `queries`, `ratings`
        WHERE `cases`.`id` = #{@case.id}
        AND `queries`.`case_id` = `cases`.`id`
        AND `ratings`.`query_id` = `queries`.`id`
        ORDER BY `queries`.`query_text` DESC, `ratings`.`doc_id` DESC
      "

      results = ActiveRecord::Base.connection.execute(sql)

      source = []
      puts 'here come sql'
      results.each do |row|

        puts "#{row.first}:#{row.second}"
        ratings_for_pair = @case.ratings.where(query_id:row.first, doc_id: row.second)
        puts "ratings count: #{ratings_for_pair.size} ---  #{ratings_for_pair.map(&:rating)}"

        ratings_by_user = {}
        ratings_for_pair.each do |r|
        end

        source << {
          "query_id": row.first,
          "doc_id": row.second,
          "ratings": ratings_for_pair.map(&:rating).to_s
        }
      end

      dfnext = Rover::DataFrame.new(source)

      dfnext.each_row do |row|
        row["bob"] = "bob"
      end
      puts dfnext

      ratings = @case.ratings
      users = []
      ratings.each do |rating|
        rating.rating = -1 if rating.rating.nil?
        #puts "rating user: #{rating.user_id}"
        users << rating.user.id unless rating.user.nil?
      end
      @df = Rover::DataFrame.new(ratings)
      @df.delete('updated_at')
      @df.delete('created_at')

      puts @df.keys

      puts @df.to_csv

      users.uniq!

            puts 'here are users'
            puts users


      puts @df

      puts "Okay, lets group"

      puts @df.group('doc_id','query_id').count




      if (1 == 1)

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
        puts df1
        puts df2

        df1 = df1.inner_join(df2, on: %w[query_id doc_id])

        puts 'JOINED'
        puts df1

        puts 'Average'
        df1['average'] = (df1["rating_#{users.first}"] * df1["rating_#{users.second}"]) / 2
        puts df1
      end

    end
    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Metrics/AbcSize
  end
end
