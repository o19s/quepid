# frozen_string_literal: true

module Api
  module V1
    # @tags books > judgements
    class JudgementsController < Api::ApiController
      before_action :set_book
      before_action :check_book
      before_action :set_judgement,   only: [ :show, :update, :destroy ]
      before_action :check_judgement, only: [ :show, :update, :destroy ]

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      # rubocop:disable Metrics/CyclomaticComplexity
      # rubocop:disable Metrics/BlockLength

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
      # rubocop:enable Metrics/BlockLength

      def show
        respond_with @judgement
      end

      # @request_body Judgement to be created [Reference:#/components/schemas/Judgement]
      # @request_body_example basic judgement [Reference:#/components/examples/BasicJudgement]
      def create
        judgement_params = extract_judgement_params
        @judgement = @book.judgements.find_or_create_by(
          query_doc_pair_id: judgement_params[:query_doc_pair_id],
          user_id:           judgement_params[:user]
        )
        @judgement.rating = judgement_params[:rating] if judgement_params[:rating].present?
        @judgement.explanation = judgement_params[:explanation] if judgement_params[:explanation].present?

        @judgement.user = User.find(judgement_params[:user_id]) if judgement_params[:user_id].present?

        @judgement.mark_unrateable if judgement_params[:unrateable]

        if @judgement.save
          respond_with @judgement
        else
          render json: @judgement.errors, status: :bad_request
        end
      end

      # @request_body Judgement to be updated [Reference:#/components/schemas/Judgement]
      # @request_body_example basic judgement [Reference:#/components/examples/BasicJudgement]
      def update
        update_params = extract_judgement_params
        if @judgement.update update_params
          respond_with @judgement
        else
          render json: @judgement.errors, status: :bad_request
        end
      end

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

      def extract_judgement_params
        params.expect(judgement: [ :rating, :unrateable, :judge_later, :query_doc_pair_id, :user_id, :explanation ])
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
