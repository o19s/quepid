# frozen_string_literal: true

module Api
  module V1
    # rubocop:disable Metrics/ClassLength
    class JudgementsController < Api::ApiController
      before_action :set_book
      before_action :check_book
      before_action :set_judgement,   only: [ :show, :update, :destroy ]
      before_action :check_judgement, only: [ :show, :update, :destroy ]

      def_param_group :judgement_params do
        param :judgement, Hash, required: true do
          param :user_id, Integer
          param :rating, Float
          param :judge_later, [ true, false ]
          param :unrateable, [ true, false ]
          param :explanation, String
        end
      end

      def_param_group :create_judgement_params do
        param :judgement, Hash, required: true do
          param :query_doc_pair_id, Integer
          param :user_id, Integer
          param :rating, Float
          param :judge_later, [ true, false ]
          param :unrateable, [ true, false ]
          param :explanation, String
        end
      end

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      # rubocop:disable Metrics/CyclomaticComplexity
      # rubocop:disable Metrics/PerceivedComplexity
      # rubocop:disable Metrics/BlockLength
      api :GET, '/api/books/:book_id/judgements',
          'List all judgements for the book.  When you request the .csv version we only return valid rated judgements.'
      param :book_id, :number,
            desc: 'The ID of the requested book.', required: true
      def index
        respond_to do |format|
          format.json do
            @judgements = @book.judgements
          end
          format.csv do
            @csv_array = []
            csv_headers = %w[query docid]

            # can't use more efficient quering because we need to include judgements where the user_id is nil.
            # Maybe someday we require a user for all judgements?  Even if the user has the name 'Anonymous'?
            # Only return rateable judgements, filter out the unrateable ones.
            # unique_judge_ids = @book.query_doc_pairs.joins(:judgements).rateable
            #  .distinct.pluck(:user_id)
            # unique_judge_ids = @book.judgements.rateable.select(:user_id).distinct.pluck(:user_id)
            unique_judge_ids = @book.query_doc_pairs.joins(:judgements)
              .distinct.pluck(:user_id)

            # unique_judges = User.where(id: @book.judgements.select(:user_id).distinct)
            # unique_judges.each do |judge|
            #  csv_headers << make_csv_safe(judge.fullname)
            # end
            unique_judges = []
            unique_judge_ids.each do |judge_id|
              judge = User.find(judge_id) unless judge_id.nil?
              unique_judges << judge
              csv_headers << make_csv_safe(if judge.nil?
                                             'Anonymous'
                                           else
                                             judge.fullname
                                           end)
            end

            @csv_array << csv_headers
            query_doc_pairs = @book.query_doc_pairs
              .joins(:judgements)
              .where.not(judgements: { rating: nil })
              .includes(:judgements)
            query_doc_pairs.each do |qdp|
              row = [ make_csv_safe(qdp.query_text), qdp.doc_id ]
              unique_judges.each do |judge|
                judgement = qdp.judgements.detect { |j| j.user == judge }
                rating = judgement.nil? ? '' : judgement.rating

                row.append rating
              end
              @csv_array << row
            end

            headers['Content-Disposition'] = "attachment; filename=\"book_#{@book.id}_judgements.csv\""
            headers['Content-Type'] ||= 'text/csv'
          end
        end
      end
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/CyclomaticComplexity
      # rubocop:enable Metrics/PerceivedComplexity
      # rubocop:enable Metrics/BlockLength

      api :GET, '/api/books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/:id',
          'Show the judgement with the given ID.'
      param :book_id, :number,
            desc: 'The ID of the requested book.', required: true
      param :query_doc_pair_id, :number,
            desc: 'The ID of the requested query doc pair.', required: true
      param :id, :number,
            desc: 'The ID of the requested judgement.', required: true
      def show
        respond_with @judgement
      end

      # rubocop:disable Metrics/AbcSize
      api :POST, '/api/books/:book_id/judgements/', 'Create a new judgement.'
      param :book_id, :number,
            desc: 'The ID of the requested book.', required: true
      param_group :create_judgement_params
      def create
        # @judgement = @book.judgements.build judgement_params
        @judgement = @book.judgements.find_or_create_by query_doc_pair_id: params[:judgement][:query_doc_pair_id],
                                                        user_id:           params[:judgement][:user]

        @judgement.rating = params[:judgement][:rating] unless params[:judgement][:rating].nil?
        @judgement.explanation = params[:judgement][:explanation] unless params[:judgement][:explanation].nil?

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
      api :PUT, '/api/books/:book_id/query_doc_pair/:query_doc_pair_id/judgements/:id', 'Update a given judgement.'
      param :book_id, :number,
            desc: 'The ID of the requested book.', required: true
      param :query_doc_pair_id, :number,
            desc: 'The ID of the requested query doc pair.', required: true
      param :id, :number,
            desc: 'The ID of the requested judgement.', required: true
      param_group :judgement_params
      def update
        update_params = judgement_params
        if @judgement.update update_params
          respond_with @judgement
        else
          render json: @judgement.errors, status: :bad_request
        end
      end

      api :DELETE, '/api/books/:book_id/query_doc_pair/:query_doc_pair_id/judgements/:id', 'Delete a given judgement.'
      param :book_id, :number,
            desc: 'The ID of the requested book.', required: true
      param :query_doc_pair_id, :number,
            desc: 'The ID of the requested query doc pair.', required: true
      param :id, :number,
            desc: 'The ID of the judgement.', required: true
      def destroy
        @judgement.destroy
        head :no_content
      end

      private

      def make_csv_safe str
        if %w[- = + @].include?(str[0])
          " #{str}"
        else
          str
        end
      end

      def judgement_params
        params.expect(judgement: [ :rating, :unrateable, :query_doc_pair_id, :user_id, :explanation ])
      end

      def set_judgement
        @judgement = @book.judgements.where(id: params[:id]).first
      end

      def check_judgement
        render json: { message: 'Query Doc Pair not found!' }, status: :not_found unless @judgement
      end
    end
    # rubocop:enable Metrics/ClassLength
  end
end
