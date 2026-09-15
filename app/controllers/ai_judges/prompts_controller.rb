# frozen_string_literal: true

module AiJudges
  class PromptsController < ApplicationController
    before_action :set_book

    def show
      redirect_to edit_ai_judge_prompt_path(params[:ai_judge_id], @book)
    end

    def edit
      @ai_judge = User.find(params.expect(:ai_judge_id))

      @query_doc_pair = if @book
                          @book.query_doc_pairs.sample
                        else
                          # Grab any query_doc_pair from a book the judge can access -
                          # owned directly (or by the judge's owner), or shared via a
                          # team. Book.for_user's team check is "does this user have a
                          # teams_members row for one of the book's teams", which is
                          # true whether that user is the judge's owner or, for a
                          # legacy/owner-less judge, the judge itself.
                          QueryDocPair
                            .where(book: Book.for_user(@ai_judge.owner || @ai_judge))
                            .order(Arel.sql(AdapterFunctions.random_function))
                            .first
                        end

      @query_doc_pair = QueryDocPair.new if @query_doc_pair.nil?
    end

    def update
      @ai_judge = User.find(params.expect(:ai_judge_id))
      @ai_judge.update(ai_judge_params)

      @query_doc_pair = QueryDocPair.new(query_doc_pair_params)
      # Form posts document_fields/options as JSON strings; .new doesn't run
      # validations, so the JsonFormatValidator hasn't parsed them into Hashes
      # yet. Trigger validation so the LLM service sees a proper Hash (otherwise
      # document_fields['image'] does substring matching on the raw JSON text
      # and the image branch never fires).
      @query_doc_pair.valid?

      llm_service = LlmService.new(@ai_judge.llm_key, @ai_judge.judge_options)
      @judgement = Judgement.new(query_doc_pair: @query_doc_pair, user: @ai_judge)
      llm_service.perform_safe_judgement @judgement

      render :edit
    end

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
    end

    # Only allow a list of trusted parameters through.
    def ai_judge_params
      params.expect(user: [ :llm_key, :system_prompt ])
    end

    def query_doc_pair_params
      params.expect(query_doc_pair: [ :document_fields, :position, :query_text, :doc_id, :notes,
                                      :information_need, { options: {} } ])
    end
  end
end
