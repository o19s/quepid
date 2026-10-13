# frozen_string_literal: true

class CaseAnnotationsController < ApplicationController
  include AnnotationPersistence

  # The id of the annotation list in core/_tune_relevance.
  LIST_ID = 'case-annotations'

  before_action :set_case
  before_action :set_annotation, only: [ :update, :destroy ]

  def create
    record = create_annotation_with_score
    if record.persisted?
      render turbo_stream: turbo_stream.prepend(LIST_ID, partial: 'core/annotation', locals: { annotation: @annotation })
    else
      render json: record.errors, status: :bad_request
    end
  end

  def update
    if @annotation.update annotation_params
      render turbo_stream: turbo_stream.replace(@annotation, partial: 'core/annotation', locals: { annotation: @annotation })
    else
      render json: @annotation.errors, status: :bad_request
    end
  end

  def destroy
    @annotation.destroy
    render turbo_stream: turbo_stream.remove(@annotation)
  end

  private

  def set_annotation
    @annotation = @case.annotations.find(params.expect(:id))
  end
end
