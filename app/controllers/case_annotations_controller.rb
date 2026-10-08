# frozen_string_literal: true

class CaseAnnotationsController < ApplicationController
  include AnnotationPersistence

  before_action :set_case
  before_action :set_annotation, only: [ :update, :destroy ]

  def index
    @annotations = @case.annotations.includes(:user, score: :try)
    render partial: 'core/annotation', collection: @annotations, as: :annotation
  end

  def create
    record = create_annotation_with_score
    if record.persisted?
      render partial: 'core/annotation', locals: { annotation: @annotation }
    else
      render json: record.errors, status: :bad_request
    end
  end

  def update
    if @annotation.update annotation_params
      render partial: 'core/annotation', locals: { annotation: @annotation }
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
    @annotation = @case.annotations.find(params.expect(:id))
  end
end
