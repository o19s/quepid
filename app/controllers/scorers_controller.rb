# frozen_string_literal: true

class ScorersController < ApplicationController
  before_action :set_scorer, only: [ :edit, :update, :destroy ]
  before_action :set_source_scorer, only: [ :clone ]

  def new
    @scorer = Scorer.new(owner: current_user, communal: false)
  end

  def edit
  end

  def create
    @scorer = Scorer.new(scorer_params.merge(owner: current_user, communal: false))
    if @scorer.save
      redirect_to edit_scorer_path(@scorer), notice: 'Scorer created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def clone
    @scorer = @source_scorer.dup
    @scorer.owner = current_user
    @scorer.communal = false
    @scorer.name = "Clone of #{@source_scorer.name}"
    @scorer.code = @source_scorer.code
    @scorer.scale = @source_scorer.scale
    @scorer.scale_with_labels = @source_scorer.scale_with_labels
    @scorer.show_scale_labels = @source_scorer.show_scale_labels

    if @scorer.save
      redirect_to edit_scorer_path(@scorer), notice: 'Scorer cloned.'
    else
      redirect_to scorers2_path, alert: 'Unable to clone scorer.'
    end
  end

  def update
    if @scorer.update(scorer_params)
      redirect_to edit_scorer_path(@scorer), notice: 'Scorer updated.'
    else
      render :edit, status: :unprocessable_content
    end
  end

  def destroy
    @scorer.destroy
    redirect_to scorers2_path, notice: 'Scorer deleted.'
  end

  private

  def set_scorer
    @scorer = Scorer.for_user(current_user).where(communal: false).find(params[:id])
  end

  def set_source_scorer
    @source_scorer = Scorer.for_user(current_user).find(params[:id])
  end

  def scorer_params
    params.require(:scorer).permit(
      :name,
      :code,
      :scale_list,
      :show_scale_labels,
      scale_with_labels: {}
    )
  end
end
