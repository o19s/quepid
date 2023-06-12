# frozen_string_literal: true

module Api
  module V1
    class JudgementsController < Api::ApiController
      before_action :find_book
      before_action :check_book
      before_action :set_judgement,   only: [ :show, :update, :destroy ]
      before_action :check_judgement, only: [ :show, :update, :destroy ]
      skip_before_action :verify_authenticity_token
      protect_from_forgery with: :null_session

      def index
        @judgements = @book.judgements

        respond_with @judgements
      end

      def show
        respond_with @judgement
      end

      # rubocop:disable Metrics/AbcSize
      def create
        # @judgement = @book.judgements.build judgement_params
        @judgement = @book.judgements.find_or_create_by query_doc_pair_id: params[:judgement][:query_doc_pair_id],
                                                        user_id:           params[:judgement][:user]

        @judgement.rating = params[:judgement][:rating] unless params[:judgement][:rating].nil?

        if params[:judgement][:user_id]
          user = User.find(params[:judgement][:user_id])
          @judgement.user = user
        end
        @judgement.mark_unrateable if params[:judgement][:unrateable] && (true == params[:judgement][:unrateable])
        if @judgement.save
          respond_with @judgement
        else
          render json: @judgement.errors, status: :bad_request
        end
      end
      # rubocop:enable Metrics/AbcSize

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
        puts "do we have current user?  #{!current_user.nil?}"
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
