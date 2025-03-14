# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team

  DEFAULT_SYSTEM_PROMPT = <<~TEXT
    You are evaluating the results from a search engine. For each query, you will be provided with multiple documents. Your task is to evaluate each document and assign a judgment on a scale of 0 to 3, where:
    - 0 indicates the document is irrelevant to the query.
    - 1 indicates the document is somewhat relevant to the query.
    - 2 indicates the document is mostly relevant to the query.
    - 3 indicates the document is perfectly relevant to the query.

    For each document, provide:
    1. An explanation of the judgment.
    2. The judgment value.

    The response should be in the following JSON format:
    {
      "explanation": "Your detailed reasoning behind the judgment",
      "judgment": <numeric value>
    }

    Here is an example:
    User:
    Query: Farm animals

    doc1:
      title: All about farm animals
      abstract: This document is all about farm animals
    Assistant:
    {
      "explanation": "This document appears to perfectly respond to the user's query",
      "judgment": 3
    }

    User:
    Query: Farm animals

    doc2:
      title: Somewhat about farm animals
      abstract: This document somewhat talks about farm animals
    Assistant:
    {
      "explanation": "This document is somewhat relevant to the user's query",
      "judgment": 1
    }

    User:
    Query: Farm animals

    doc3:
      title: This document has nothing to do with farm animals
      abstract: We will talk about everything except for farm animals.
    Assistant:
    {
      "explanation": "This document is not relevant at all to the user's query",
      "judgment": 0
    }
  TEXT

  def show
    @ai_judge = User.find(params[:id])
    render 'edit'
  end

  def new
    @ai_judge = User.new
    @ai_judge.system_prompt = DEFAULT_SYSTEM_PROMPT
    @ai_judge.judge_options = {
      llm_service_url: 'https://api.openai.com',
      llm_model:       'gpt-4',
      llm_timeout:     30,
    }
  end

  def edit
    @ai_judge = User.find(params[:id])
  end

  def create
    @ai_judge = User.new(ai_judge_params)

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

  def ai_judge_params
    params_to_return = params.expect(user: [ :name, :llm_key, :system_prompt, :options, { judge_options: {} } ])
    params_to_return[:options] = JSON.parse(params_to_return[:options]) if params_to_return[:options]

    params_to_return
  end
end
