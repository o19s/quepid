# frozen_string_literal: true

module Api
  module V1
    class JudgementsController < Api::ApiController
      before_action :find_book
      before_action :check_book
      before_action :set_judgement,   only: [ :show, :update, :destroy ]
      before_action :check_judgement, only: [ :show, :update, :destroy ]

      def index
        @judgements = @book.judgements

        respond_with @judgements
      end

      def show
        respond_with @judgement
      end

      def create
        puts 'HERE I AM'
        @judgement = @book.judgements.build judgement_params

        if @judgement.save
          respond_with @book, @judgement
        else
          render json: @judgement.errors, status: :bad_request
        end
      end

      def update
        update_params = judgement_params
        if @judgement.update update_params
          respond_with @judgement
        else
          render json: @judgement.errors, status: :bad_request
        end
      end

      def destroy
        @judgement.destroy
        render json: {}, status: :no_content
      end

      private

      def judgement_params
        params.require(:judgement).permit(:rating, :unrateable, :query_doc_pair_id, :user_id)
      end

      def find_book
        @book = current_user.books_involved_with.where(id: params[:book_id]).first
      end

      def check_book
        render json: { message: 'Book not found!' }, status: :not_found unless @book
      end

      def set_judgement
        @judgement = @book.judgements.where(id: params[:id]).first
      end

      def check_judgement
        render json: { message: 'Query Doc Pair not found!' }, status: :not_found unless @judgement
      end
    end
  end
end
