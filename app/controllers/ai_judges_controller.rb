# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team, only: [ :new, :clone, :create, :update, :destroy ]
  before_action :set_book_id
  before_action :set_ai_judge, only: [ :show, :edit, :update, :destroy ]

  DEFAULT_SYSTEM_PROMPT = LlmProvider::CHAT_SYSTEM_PROMPT

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

  def clone
    source = AiJudge.for_user(current_user).where(id: @team.members.select(:id)).find(params.expect(:id))
    @ai_judge = current_user.owned_ai_judges.build(
      name:          "Clone of #{source.name}",
      llm_key:       source.llm_key,
      system_prompt: source.system_prompt,
      judge_options: source.judge_options.deep_dup
    )
    @ai_judge.team_ids = [ @team.id ]
    render :new
  end

  def edit; end

  def create
    @ai_judge = current_user.owned_ai_judges.build
    @ai_judge.assign_attributes(ai_judge_params)

    if @ai_judge.errors.empty? && @ai_judge.save
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to(@team ? team_path(@team) : ai_judge_path(@ai_judge), notice: 'AI Judge was successfully created.', status: :see_other)
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    @ai_judge.assign_attributes(ai_judge_params)
    if @ai_judge.errors.empty? && @ai_judge.save
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to(@team ? team_path(@team) : ai_judge_path(@ai_judge), notice: 'AI Judge was successfully updated.', status: :see_other)
    else
      render 'edit', status: :unprocessable_content
    end
  end

  def destroy
    @ai_judge.destroy
    redirect_to(@team ? team_path(@team) : ai_judges_path, status: :see_other)
  end

  private

  def set_book_id
    @book_id = params[:book_id]
    @book = current_user.books_involved_with.find_by(id: @book_id)
  end

  def set_team
    @team = current_user.teams.find(params.expect(:team_id)) if params[:team_id].present?
  end

  def set_ai_judge
    @ai_judge = AiJudge.for_user(current_user).find(params.expect(:id))
  end

  # Checkboxes suck: only touch teams the current user can actually see, so
  # this can't accidentally unshare the judge from a team the submitting
  # user isn't a member of (BooksController#update's team_ids handling
  # doesn't scope to current_user.teams the same way - don't copy that
  # pattern). Loads current_user.teams once and derives both the
  # membership check and the selected teams from it, rather than querying
  # it twice. Used by both create (where ai_judge.teams starts empty, so
  # there's nothing to keep) and update (where it is).
  def apply_team_ids ai_judge, team_ids
    user_teams = current_user.teams.to_a
    selected_ids = Array(team_ids).compact_blank.map(&:to_i)

    kept_teams = ai_judge.teams.reject { |t| user_teams.any? { |ut| ut.id == t.id } }
    selected_teams = user_teams.select { |t| selected_ids.include?(t.id) }
    ai_judge.teams.replace(kept_teams | selected_teams)
  end

  # The team_ids checkboxes render inside the `user` form object
  # (form_with model: @ai_judge), so they submit as user[team_ids][],
  # not a top-level param.
  def submitted_team_ids
    params.dig(:user, :team_ids) || (@team ? [ @team.id ] : [])
  end

  def ai_judge_params
    params_to_return = params.expect(user: [ :name, :llm_key, :system_prompt, :options, { judge_options: {} } ])
    if params_to_return[:options]
      @submitted_options = params_to_return[:options]
      parsed_options = JSON.parse(@submitted_options)
      unless parsed_options.is_a?(Hash) && (parsed_options['judge_options'].nil? || parsed_options['judge_options'].is_a?(Hash))
        @ai_judge.errors.add(:options, 'must contain a judge_options object')
        return params_to_return.except(:options)
      end
      params_to_return[:options] = parsed_options
    end

    params_to_return
  rescue JSON::ParserError
    @ai_judge.errors.add(:options, 'must be valid JSON')
    params_to_return.except(:options)
  end
end
