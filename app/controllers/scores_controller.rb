# frozen_string_literal: true

class ScoresController < ApplicationController
  include Pagy::Backend
  before_action :set_case
  before_action :set_score, only: [ :destroy ]
  def index
    query = @case.scores

    query = query.where(scorer_id: params[:scorer_id]) if params[:scorer_id].present?

    @pagy, @scores = pagy(query.order('updated_at'))

    scorers = @case.scores.map(&:scorer).uniq
    @scorer_options = scorers.map { |scorer| [ scorer.name, scorer.id ] }
  end

  def destroy
    @score.destroy
    redirect_to case_scores_path(@case)
  end

  def set_score
    @score = Score.find(params[:id])
  end
end
