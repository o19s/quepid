# frozen_string_literal: true

class ScoresController < ApplicationController
  include Pagy::Method

  before_action :set_case

  def index
    ransack_params = { scorer_id_eq: params[:scorer_id] }
    @q = @case.scores.ransack(ransack_params)
    @q.sorts = 'updated_at asc' if @q.sorts.empty?

    @pagy, @scores = pagy(@q.result)

    scorers = @case.scores.includes([ :scorer ]).map(&:scorer).uniq
    @scorer_options = scorers.map { |scorer| [ scorer.name, scorer.id ] }
  end

  def destroy_multiple
    @case.scores.where(id: params[:score_ids]).destroy_all
    redirect_to case_scores_path(@case, scorer_id: params[:scorer_id]),
                notice: 'Selected scores were successfully deleted.'
  end

  def set_score
    @score = Score.find(params.expect(:id))
  end
end
