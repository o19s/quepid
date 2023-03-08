# frozen_string_literal: true

require 'csv'

module Api
  module V1
    class BooksController < Api::ApiController
      before_action :find_book, only: [ :show ]
      before_action :check_book, only: [ :show ]

      # rubocop:disable Metrics/MethodLength
      def show
        respond_to do |format|
          format.json
          format.csv do
            @csv_array = []
            csv_headers = %w[query docid]

            unique_raters = @book.judgements.collect(&:user).uniq
            unique_raters.each { |rater| csv_headers << make_csv_safe(rater.name) }

            @csv_array << csv_headers

            @book.query_doc_pairs.each do |qdp|
              row = [ make_csv_safe(qdp.query_text), qdp.doc_id ]
              unique_raters.each do |rater|
                judgement = qdp.judgements.where(user_id: rater.id).first
                rating = judgement.nil? ? '' : judgement.rating
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

      private

      def find_book
        @book = current_user.books_involved_with.where(id: params[:id]).first
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
