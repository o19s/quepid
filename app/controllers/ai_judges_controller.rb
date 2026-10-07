# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team, only: [ :new, :clone ]
  before_action :set_ai_judge, only: [ :show, :edit, :update, :destroy, :clone ]
  before_action :set_book, only: [ :show, :new, :edit, :create, :update ]
  before_action :set_scorer, only: [ :show, :new, :edit, :create, :update ]

  helper_method :escalation_targets

  def index
    @ai_judges = AiJudge.for_user(current_user).includes(:owner, :teams).preload(:escalates_to, :escalated_from).order(:name)
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
      llm_provider:       openai.key,
      llm_service_url:    openai.default_service_url,
      llm_model:          openai.default_model,
      llm_timeout:        30,
      llm_api_version:    openai.default_api_version,
      llm_include_images: true,
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

    if escalation_target_visible? && @ai_judge.save
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to ai_judge_path(@ai_judge), notice: 'AI Judge was successfully created.'
    else
      render :new
    end
  end

  def update
    @ai_judge.assign_attributes(ai_judge_params)

    if escalation_target_visible? && @ai_judge.save
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to ai_judge_path(@ai_judge), notice: 'AI Judge was successfully updated.'
    else
      render 'edit'
    end
  end

  def destroy
    if @ai_judge.destroy
      redirect_to ai_judges_path, notice: "AI Judge #{@ai_judge.name} was deleted."
    else
      redirect_to ai_judges_path, alert: "Could not delete AI Judge #{@ai_judge.name}: #{@ai_judge.errors.full_messages.to_sentence}"
    end
  end

  private

  def set_team
    @team = current_user.teams.find_by(id: params[:team_id])
  end

  def set_ai_judge
    @ai_judge = AiJudge.for_user(current_user).find(params.expect(:id))
  end

  # Lets the form show the book's scale (scoped the same way as
  # AiJudges::WizardController), matching what the judge will actually be
  # sent. Included on create/update, not just new/edit, so a validation
  # failure re-render still has the book from the form's hidden field.
  def set_book
    @book_id = params[:book_id]
    @book = current_user.books_involved_with.where(id: @book_id).first if @book_id.present?
  end

  # Lets "Test & Refine" run against a scorer's scale when there's no book
  # context - the same scale a book would've copied from one (JudgeScale.for_scorer),
  # without needing a real book's query/doc pairs. Mutually exclusive with
  # book_id in practice (the form's scale picker is only shown when there's
  # no @book), but both are independent params so either can be set.
  def set_scorer
    @scorer_id = params[:scorer_id]
    @scorer = current_user.scorers_involved_with.where(id: @scorer_id).first if @scorer_id.present?
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

  # The judges this one may wake: any the current user can see, except
  # itself. A target that was set by someone who could see it, and that the
  # current user can't, stays in the list so an unrelated save keeps it.
  def escalation_targets
    @escalation_targets ||= begin
      visible = AiJudge.for_user(current_user).where.not(id: @ai_judge.id).order(:name).to_a.uniq
      current = @ai_judge.escalates_to
      current && visible.exclude?(current) ? visible + [ current ] : visible
    end
  end

  # Only a judge the current user can see may be chosen, the same scope as
  # the AI Judges list. Checked here, not on the model, because visibility
  # depends on who is saving.
  def escalation_target_visible?
    return true unless @ai_judge.escalates_to_id_changed? && @ai_judge.escalates_to_id
    return true if AiJudge.for_user(current_user).exists?(id: @ai_judge.escalates_to_id)

    @ai_judge.errors.add(:escalates_to, 'is not an AI judge you can use')
    false
  end

  def ai_judge_params
    params_to_return = params.expect(user: [ :name, :llm_key, :system_prompt, :options, :escalates_to_id,
                                             { judge_options: {} } ])
    params_to_return[:options] = JSON.parse(params_to_return[:options]) if params_to_return[:options]

    params_to_return
  end
end
