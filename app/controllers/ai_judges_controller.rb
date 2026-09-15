# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team, only: [ :new ]
  before_action :set_ai_judge, only: [ :show, :edit, :update, :destroy ]

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

  def index
    @ai_judges = AiJudge.for_user(current_user).includes(:owner, :teams).order(:name)
  end

  def show
    render 'edit'
  end

  def new
    @ai_judge = AiJudge.new
    @ai_judge.team_ids = [ @team.id ] if @team
    @ai_judge.system_prompt = DEFAULT_SYSTEM_PROMPT
    @ai_judge.judge_options = {
      llm_provider:    'openai',
      llm_service_url: 'https://api.openai.com',
      llm_model:       'gpt-4o',
      llm_timeout:     30,
      llm_api_version: '',
    }
  end

  def edit; end

  def create
    @ai_judge = AiJudge.new(ai_judge_params.merge(owner: current_user))

    if @ai_judge.save
      @ai_judge.teams = teams_from_ids(submitted_team_ids)
      redirect_to ai_judge_path(@ai_judge)
    else
      render :new
    end
  end

  def update
    if @ai_judge.update(ai_judge_params)
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to ai_judge_path(@ai_judge)
    else
      render 'edit'
    end
  end

  def destroy
    @ai_judge.destroy
    redirect_to ai_judges_path
  end

  private

  def set_team
    @team = current_user.teams.find_by(id: params[:team_id])
  end

  def set_ai_judge
    @ai_judge = AiJudge.for_user(current_user).find(params.expect(:id))
  end

  # Checkboxes suck: only touch teams the current user can actually see, so
  # this can't accidentally unshare the judge from a team the submitting
  # user isn't a member of. Mirrors BooksController#update's team_ids
  # handling. Loads current_user.teams once and derives both the
  # membership check and the selected teams from it, rather than querying
  # it twice.
  def apply_team_ids ai_judge, team_ids
    user_teams = current_user.teams.to_a
    selected_ids = Array(team_ids).compact_blank.map(&:to_i)

    kept_teams = ai_judge.teams.reject { |t| user_teams.any? { |ut| ut.id == t.id } }
    selected_teams = user_teams.select { |t| selected_ids.include?(t.id) }
    ai_judge.teams.replace(kept_teams | selected_teams)
  end

  def teams_from_ids team_ids
    return [] if team_ids.blank?

    current_user.teams.where(id: team_ids.compact_blank)
  end

  # The team_ids checkboxes render inside the `user` form object
  # (form_with model: @ai_judge), so they submit as user[team_ids][],
  # not a top-level param.
  def submitted_team_ids
    params.dig(:user, :team_ids)
  end

  def ai_judge_params
    params_to_return = params.expect(user: [ :name, :llm_key, :system_prompt, :options, { judge_options: {} } ])
    params_to_return[:options] = JSON.parse(params_to_return[:options]) if params_to_return[:options]

    params_to_return
  end
end
