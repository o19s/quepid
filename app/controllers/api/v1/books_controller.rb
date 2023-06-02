# frozen_string_literal: true

require 'csv'

module Api
  module V1
    class BooksController < Api::ApiController
      before_action :find_book, only: [ :show ]
      before_action :check_book, only: [ :show ]

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      # rubocop:disable Metrics/CyclomaticComplexity
      # rubocop:disable Metrics/PerceivedComplexity
      # rubocop:disable Metrics/BlockLength
      def show
        respond_to do |format|
          format.json
          format.csv do
            @csv_array = []
            csv_headers = %w[query docid]

            # Only return rateable judgements, filter out the unrateable ones.
            unique_raters = @book.judgements.rateable.collect(&:user).uniq

            # this logic about using email versus name is kind of awful.  Think about user.full_name or user.identifier?
            unique_raters.each do |rater|
              csv_headers << make_csv_safe(if rater.nil?
                                             'Unknown'
                                           else
                                             (rater.name.presence || rater.email)
                                           end)
            end

            @csv_array << csv_headers

            @book.query_doc_pairs.each do |qdp|
              row = [ make_csv_safe(qdp.query_text), qdp.doc_id ]
              unique_raters.each do |rater|
                judgement = qdp.judgements.find { |judgement| judgement.user = rater }
                rating = if judgement.nil?
                           ''
                         else
                           judgement.nil? ? '' : judgement.rating
                         end
                row.append rating
              end
              @csv_array << row
            end

            headers['Content-Disposition'] = "attachment; filename=\"book_#{@book.id}_export.csv\""
            headers['Content-Type'] ||= 'text/csv'
          end
        end
      end
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/CyclomaticComplexity
      # rubocop:enable Metrics/PerceivedComplexity
      # rubocop:enable Metrics/BlockLength

      private

      def find_book
        @book = current_user.books_involved_with.where(id: params[:id]).includes(:query_doc_pairs).preload([ query_doc_pairs: [ :judgements ] ]).first
      end

      def check_book
        render json: { message: 'Book not found!' }, status: :not_found unless @book
      end

      def make_csv_safe str
        if %w[- = + @].include?(str[0])
          " #{str}"
        else
          str
        end
      end
    end
  end
end
