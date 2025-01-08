# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team, only: [ :new, :create, :destroy ]
  def new
    @ai_judge = User.new
  end

  def create
    @ai_judge = User.new(ai_judge_params)
    @ai_judge.password = SecureRandom.hex(8)

    if @ai_judge.save
      @team.members << @ai_judge
      @team.save
      redirect_to teams_core_path @team
    else
      render :new
    end
  end

  def destroy
    @ai_judge = User.find(params[:id])
    @ai_judge.destroy
    redirect_to teams_core_path @team # , notice: 'AI Judge was successfully removed.'
  end

  private

  def set_team
    @team = Team.find(params.expect(:team_id))
  end

  # Only allow a list of trusted parameters through.
  def ai_judge_params
    params.expect(user: [ :email, :name, :openai_key, :prompt ])
  end
end
