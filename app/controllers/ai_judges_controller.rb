# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team, only: [ :new, :clone ]
  before_action :set_ai_judge, only: [ :show, :edit, :update, :destroy, :clone ]
  before_action :set_book, only: [ :show, :new, :edit, :create, :update ]

  # Kept as a constant because tests and other callers refer to it; the text
  # itself now lives with the providers that use it (LlmProvider), since what
  # a judge should be told depends on the dialect it speaks.
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
    openai = LlmProvider.find('openai')
    @ai_judge.system_prompt = openai.default_system_prompt
    @ai_judge.judge_options = {
      llm_provider:    openai.key,
      llm_service_url: openai.default_service_url,
      llm_model:       openai.default_model,
      llm_timeout:     30,
      llm_api_version: openai.default_api_version,
    }
  end

  def edit
  end

  def clone
    @ai_judge = @ai_judge.dup
    @ai_judge.name = "Clone of #{@ai_judge.name}"
    # dup doesn't copy has_and_belongs_to_many associations - pre-select the
    # team this clone was started from, matching #new's behavior.
    @ai_judge.team_ids = [ @team.id ] if @team
  end

  def create
    @ai_judge = current_user.owned_ai_judges.build(ai_judge_params)

    if unavailable_provider?(@ai_judge) || !@ai_judge.save
      render :new
    else
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to ai_judge_path(@ai_judge), notice: 'AI Judge was successfully created.'
    end
  end

  def update
    @ai_judge.assign_attributes(ai_judge_params)

    if unavailable_provider?(@ai_judge) || !@ai_judge.save
      render 'edit'
    else
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to ai_judge_path(@ai_judge), notice: 'AI Judge was successfully updated.'
    end
  end

  def destroy
    @ai_judge.destroy
    redirect_to ai_judges_path
  end

  private

  # A provider can appear in the form before Quepid can actually judge with it, so teams
  # can see what it will need and get a key ready (LlmProvider#coming_soon?). Selecting
  # one is fine; saving a judge that would fail on its first run is not.
  def unavailable_provider? ai_judge
    provider = LlmProvider.find(ai_judge.judge_options[:llm_provider])
    return false unless provider&.coming_soon?

    ai_judge.errors.add(:base, "#{provider.label} is not available yet, so an AI Judge cannot use it.")
    true
  end

  def set_team
    @team = current_user.teams.find_by(id: params[:team_id])
  end

  def set_ai_judge
    @ai_judge = AiJudge.for_user(current_user).find(params.expect(:id))
  end

  # Arriving from a book (e.g. its Judgement Stats "Refine Prompt" link), the form shows
  # that book's scale as the judge will be sent it. Scoped like AiJudges::WizardController.
  # Covers create/update too (via the form's hidden book_id field) so a
  # validation failure re-render doesn't lose that context.
  def set_book
    @book_id = params[:book_id]
    @book = current_user.books_involved_with.where(id: @book_id).first if @book_id.present?
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
    params.dig(:user, :team_ids)
  end

  def ai_judge_params
    params_to_return = params.expect(user: [ :name, :llm_key, :system_prompt, :options, { judge_options: {} } ])
    params_to_return[:options] = JSON.parse(params_to_return[:options]) if params_to_return[:options]

    params_to_return
  end
end
