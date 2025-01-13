# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team

  DEFAULT_PROMPT = <<~TEXT
    You are evaluating the results from a search engine. You will be shown a query followed by several documents. Give each document a judgment on a scale between 0 and 2 where 0 is irrelevant and 2 is perfectly relevant.
    Example:
    User:
    Query: Farm animals
    doc1:
     	title: All about farm animals
     	abstract: This document is all about farm animals
          Assistant:
     	explanation: This document appears to perfectly respond to the user's query
     	judgment: 2
          User:
          Query: Farm animals
    doc2:
     	title: Somewhat about farm animals
     	abstract: This document somewhat talks about farm animals
          Assistant:
     	explanation: This document is somewhat relevant to the user's query
     	judgment: 1
          User:
          Query: Farm animals
    doc3:
     	title: This document has nothing to do with farm animals
     	abstract: We will talk about everything except for farm animals.
          Assistant:
     	explanation: This document is not relevant at all to the user's query
     	judgment: 0
  TEXT

  def new
    @ai_judge = User.new
    @ai_judge.prompt = DEFAULT_PROMPT
  end

  def edit
    @ai_judge = User.find(params[:id])
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

  def update
    @ai_judge = User.find(params[:id])
    if @ai_judge.update(ai_judge_params)
      redirect_to teams_core_path @team
    else
      render 'edit'
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
    params.expect(user: [ :name, :openai_key, :prompt ])
  end
end
