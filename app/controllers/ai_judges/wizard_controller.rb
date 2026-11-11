# frozen_string_literal: true

module AiJudges
  # Stateless JSON endpoints backing the "Test & Refine" step of the AI judge
  # creation/edit wizard. Neither action ever creates or updates a database
  # record - they run the *current* (possibly unsaved) form values through
  # LlmService entirely in memory, the same way AiJudgesController#new lets
  # you fill out a form before anything is persisted.
  class WizardController < ApplicationController
    before_action :set_book
    before_action :set_scorer

    # Grab a query/doc pair to test against - book-scoped if a book_id was
    # given (e.g. arriving from a book's Judgement Stats page), otherwise any
    # book the *requesting* user can access. Deliberately not scoped to the
    # judge's owner: a judge shared via a team must not leak documents from
    # books private to its owner to the teammate testing it.
    def sample_query_doc_pair
      query_doc_pair = if @book
                         @book.query_doc_pairs.sample
                       else
                         # Two-stage sample: a random book first (a user's accessible book
                         # count is small), then .sample within it - rather than ORDER BY
                         # RAND() across every query/doc pair the user can reach, which forces
                         # a full scan + sort of that entire set (tens of thousands of rows
                         # for an active user) on every edit-page load.
                         random_book = Book.for_user(current_user)
                           .where(id: QueryDocPair.select(:book_id))
                           .order(Arel.sql(AdapterFunctions.random_function))
                           .first
                         random_book&.query_doc_pairs&.sample
                       end
      query_doc_pair ||= QueryDocPair.new

      render json: { query_doc_pair: query_doc_pair.as_json(
        only: [ :id, :query_text, :doc_id, :information_need, :document_fields, :options, :notes, :position ]
      ) }
    end

    def test_prompt
      # A judge being edited lends its saved settings: a judge from before connections has its
      # own key, which the form never shows, and its connection may be one only its owner can pick.
      saved = AiJudge.for_user(current_user).find_by(id: params[:ai_judge_id])
      connection = test_connection(saved)
      ai_judge = draft_judge(saved, connection)

      # The judge is handed the scale, never the book/scorer it came from -
      # a book's own scale if there's a book context, otherwise a scorer's
      # (picked in the form's scale picker when there's no book).
      scale = @book ? JudgeScale.for(@book) : JudgeScale.for_scorer(@scorer)
      provider = LlmProvider.find(ai_judge.judge_options[:llm_provider])
      if provider&.needs_scale? && scale.empty?
        error = "#{provider.label} rates against a scale, so it can only be tested from a book, " \
                'or by picking a rating scale in the form.'
        render json: { error: error }, status: :unprocessable_content
        return
      end

      if (error = test_setup_problem(connection))
        render json: { error: error }, status: :unprocessable_content
        return
      end

      query_doc_pair = QueryDocPair.new(query_doc_pair_params)
      # Form posts document_fields/options as JSON strings; .new doesn't run
      # validations, so the JsonFormatValidator hasn't parsed them into Hashes
      # yet. Trigger validation so the LLM service sees a proper Hash (otherwise
      # document_fields['image'] does substring matching on the raw JSON text
      # and the image branch never fires). This query_doc_pair is deliberately
      # never linked to a real book (it's an ephemeral, unsaved object for
      # testing a prompt), so `belongs_to :book` is expected to "fail" here and
      # must be ignored - only bail out on an actual JSON format error.
      query_doc_pair.valid?
      json_errors = query_doc_pair.errors[:document_fields] + query_doc_pair.errors[:options]
      if json_errors.any?
        render json: { error: json_errors.to_sentence }, status: :unprocessable_content
        return
      end

      llm_service = ai_judge.llm_service
      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: ai_judge)
      llm_service.perform_safe_judgement judgement, scale: scale
      JudgementFinalizer.call judgement, scale: scale

      render json: { rating: judgement.rating, explanation: judgement.explanation, unrateable: judgement.unrateable }
    end

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
    end

    def set_scorer
      @scorer = current_user.scorers_involved_with.where(id: params[:scorer_id]).first
    end

    # The connection the form has picked: one the user can select, or the one the judge being
    # edited already has (a teammate testing a shared judge runs it on its owner's connection).
    def test_connection saved
      id = params[:connection_id].presence
      return nil if id.nil?
      return saved.connection if saved && saved.connection_id.to_s == id.to_s

      current_user.connections_involved_with.find_by(id: id)
    end

    # The form's current values, unsaved, calling out the way the judge would.
    def draft_judge saved, connection
      ai_judge = AiJudge.new(system_prompt: params[:system_prompt], connection: connection,
                             llm_key: connection ? nil : saved&.llm_key)
      ai_judge.judge_options = AiJudge.judge_options_with_connection_provider(judge_options_params.to_h, connection)
      ai_judge
    end

    def test_setup_problem connection
      return "That connection isn't one you can use." if params[:connection_id].present? && connection.nil?
      return connection_capability_problem(connection) if connection

      'Choose a connection to test the judge with.'
    end

    # Same capability check AiJudge#connection_problem makes at save time (a connection whose
    # provider can't chat or judge), so a preview never gets further than the save path would -
    # draft_judge's unsaved AiJudge is never validated, so this calls the class method
    # connection_problem itself relies on instead of re-deriving the rule.
    def connection_capability_problem connection
      reason = AiJudge.unsupported_for_judging_reason(connection)
      "That connection #{reason}." if reason
    end

    def query_doc_pair_params
      params.expect(query_doc_pair: [ :document_fields, :position, :query_text, :doc_id, :notes,
                                      :information_need, :options, { options: {} } ])
    end

    def judge_options_params
      params.fetch(:judge_options, ActionController::Parameters.new)
        .permit(:llm_provider, :llm_service_url, :llm_model, :llm_timeout, :llm_api_version, :llm_include_images,
                *LlmProvider.option_keys)
    end
  end
end
