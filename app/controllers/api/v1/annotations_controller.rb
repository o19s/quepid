# frozen_string_literal: true

module Api
  module V1
    class AnnotationsController < Api::ApiController
      before_action :set_case
      before_action :check_case
      before_action :set_annotation, only: [ :update, :destroy ]

      def index
        @annotations = @case.annotations.includes(:score)

        respond_with @annotations
      end

      # rubocop:disable Metrics/MethodLength
      def create
        the_score_params = score_params.merge(
          user_id:    current_user.id,
          created_at: Time.zone.now
        )

        @score = @case.scores.build the_score_params

        if @score.save
          @annotation = Annotation.new annotation_params
          @annotation.user  = current_user
          @annotation.score = @score

          if @annotation.save
            respond_with @annotation
          else
            render json: @annotation.errors, status: :bad_request
          end
        else
          render json: @score.errors, status: :bad_request
        end
      end
      # rubocop:enable Metrics/MethodLength

      def update
        if @annotation.update annotation_params
          respond_with @annotation
        else
          render json: @annotation.errors, status: :bad_request
        end
      end

      def destroy
        @annotation.destroy
        head :no_content
      end

      private

      def set_annotation
        @annotation = @case.annotations.where(id: params[:id]).first

        render json: { message: 'Annotation not found!' }, status: :not_found unless @annotation
      end

      def annotation_params
        params.expect(
          annotation: [ :message,
                        :source ]
        )
      end

      def score_params
        params.expect(
          score: [ :all_rated,
                   :score,
                   :try_id,
                   { queries: [] } ]
        )
      end
    end
  end
end
