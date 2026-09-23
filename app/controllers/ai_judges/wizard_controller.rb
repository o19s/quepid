# frozen_string_literal: true

module AiJudges
  # Stateless JSON endpoints backing the "Test & Refine" step of the AI judge
  # creation/edit wizard. Neither action ever creates or updates a database
  # record - they run the *current* (possibly unsaved) form values through
  # LlmService entirely in memory, the same way AiJudgesController#new lets
  # you fill out a form before anything is persisted.
  class WizardController < ApplicationController
    before_action :set_book

    # Grab a query/doc pair to test against - book-scoped if a book_id was
    # given (e.g. arriving from a book's Judgement Stats page), otherwise any
    # book the *requesting* user can access. Deliberately not scoped to the
    # judge's owner: a judge shared via a team must not leak documents from
    # books private to its owner to the teammate testing it.
    def sample_query_doc_pair
      query_doc_pair = if @book
                         @book.query_doc_pairs.sample
                       else
                         QueryDocPair
                           .where(book: Book.for_user(current_user))
                           .order(Arel.sql(AdapterFunctions.random_function))
                           .first
                       end
      query_doc_pair ||= QueryDocPair.new

      render json: { query_doc_pair: query_doc_pair.as_json(
        only: [ :id, :query_text, :doc_id, :information_need, :document_fields, :options, :notes, :position ]
      ) }
    end

    def test_prompt
      ai_judge = AiJudge.new(system_prompt: params[:system_prompt], llm_key: params[:llm_key])
      ai_judge.judge_options = judge_options_params.to_h

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

      llm_service = LlmService.new(ai_judge.llm_key, ai_judge.judge_options)
      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: ai_judge)
      llm_service.perform_safe_judgement judgement, book: @book
      # Hold the preview to the same rules a real judging run applies, so a
      # rating this book would reject can't look fine while you tune the prompt.
      # Nothing is persisted here -- the finalizer only marks the in-memory record.
      JudgementFinalizer.call judgement, book: @book

      render json: { rating: judgement.rating, explanation: judgement.explanation, unrateable: judgement.unrateable }
    end

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
    end

    def query_doc_pair_params
      params.expect(query_doc_pair: [ :document_fields, :position, :query_text, :doc_id, :notes,
                                      :information_need, { options: {} } ])
    end

    # The common options plus any a provider declares for itself (e.g. Jev's
    # confidence floor), so the preview runs with what the form would save.
    def judge_options_params
      params.fetch(:judge_options, {})
        .permit(:llm_provider, :llm_service_url, :llm_model, :llm_timeout, :llm_api_version,
                *LlmProviders.option_field_specs.keys)
    end
  end
end
