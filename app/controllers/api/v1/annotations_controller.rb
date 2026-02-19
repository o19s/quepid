# frozen_string_literal: true

module Api
  module V1
    # Handles case annotations: create, update, destroy. Supports JSON (API) and
    # Turbo Stream (prepend AnnotationComponent on create).
    #
    # @see docs/turbo_streams_guide.md
    class AnnotationsController < Api::ApiController
      skip_before_action :set_default_response_format, only: [ :create ]
      before_action :set_case
      before_action :check_case
      before_action :set_annotation, only: [ :update, :destroy ]
      before_action :set_create_response_format, only: [ :create ]

      def index
        @annotations = @case.annotations.includes(:score)

        respond_with @annotations
      end

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
            respond_to do |format|
              format.turbo_stream do
                html = render_to_string(
                  AnnotationComponent.new(annotation: @annotation, case_id: @case.id)
                )
                render turbo_stream: turbo_stream.prepend('annotations_list', html), status: :created
              end
              format.json { respond_with @annotation }
            end
          else
            render json: @annotation.errors, status: :bad_request
          end
        else
          render json: @score.errors, status: :bad_request
        end
      end

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

      def set_create_response_format
        request.format = :turbo_stream if request.headers['Accept']&.include?('turbo-stream')
        request.format = :json if :turbo_stream != request.format
      end
    end
  end
end
