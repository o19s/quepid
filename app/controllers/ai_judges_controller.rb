# frozen_string_literal: true

class AiJudgesController < ApplicationController
  include TeamAssignable

  before_action :set_team, only: [ :new, :clone, :create, :update, :destroy ]
  before_action :set_ai_judge, only: [ :show, :edit, :update, :destroy ]
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
    provider = LlmProvider.find('openai')
    @ai_judge.system_prompt = provider.default_system_prompt
    @ai_judge.judge_options = {
      llm_provider:    provider.key,
      llm_model:       provider.default_model,
      llm_api_version: provider.default_api_version,
    }
  end

  def clone
    source = AiJudge.for_user(current_user).where(id: @team.members.select(:id)).find(params.expect(:id))
    # The copy is the cloner's own judge, so it calls out through a connection they pick, never
    # the original's key or connection.
    @ai_judge = current_user.owned_ai_judges.build(
      name:          "Clone of #{source.name}",
      system_prompt: source.system_prompt,
      judge_options: source.judge_options.except(:llm_service_url, :llm_timeout)
    )
    @ai_judge.team_ids = [ @team.id ]
    @ai_judge.errors.add(:connection, 'is required: choose one of your connections for this copy')
    render :new
  end

  def edit; end

  def create
    @ai_judge = current_user.owned_ai_judges.build
    @ai_judge.connection_assignment_user = current_user
    @ai_judge.assign_attributes(ai_judge_params)
    @ai_judge.errors.add(:connection, 'is required: it holds the URL and key (create one under Connections)') unless @ai_judge.connection

    if @ai_judge.errors.empty? && escalation_target_visible? && @ai_judge.save
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to(@team ? team_path(@team) : ai_judge_path(@ai_judge), notice: 'AI Judge was successfully created.', status: :see_other)
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    @ai_judge.connection_assignment_user = current_user
    @ai_judge.assign_attributes(ai_judge_params)
    # A judge from before connections keeps running on its own settings, but changes to it wait until it is on one.
    @ai_judge.errors.add(:connection, 'is required: choose a connection first') unless @ai_judge.connection
    if @ai_judge.errors.empty? && escalation_target_visible? && @ai_judge.save
      apply_team_ids(@ai_judge, submitted_team_ids)
      redirect_to(@team ? team_path(@team) : ai_judge_path(@ai_judge), notice: 'AI Judge was successfully updated.', status: :see_other)
    else
      render 'edit', status: :unprocessable_content
    end
  end

  def destroy
    if @ai_judge.destroy
      redirect_to(@team ? team_path(@team) : ai_judges_path, notice: "AI Judge #{@ai_judge.name} was deleted.", status: :see_other)
    else
      redirect_to(@team ? team_path(@team) : ai_judges_path,
                  alert:  "Could not delete AI Judge #{@ai_judge.name}: #{@ai_judge.errors.full_messages.to_sentence}",
                  status: :see_other)
    end
  end

  private

  def set_team
    @team = current_user.teams.find(params.expect(:team_id)) if params[:team_id].present?
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

  # The team_ids checkboxes render inside the `user` form object
  # (form_with model: @ai_judge), so they submit as user[team_ids][],
  # not a top-level param.
  def submitted_team_ids
    params.dig(:user, :team_ids) || (@team ? [ @team.id ] : [])
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
    params_to_return = params.expect(user: [ :name, :connection_id, :system_prompt, :options, :escalates_to_id,
                                             { judge_options: {} } ])
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
