# frozen_string_literal: true

module AiJudges
  class PromptsController < ApplicationController
    before_action :set_book

    def show
      redirect_to edit_ai_judge_prompt_path(params[:ai_judge_id], @book)
    end

    def edit
      @ai_judge = User.find(params[:ai_judge_id])

      @query_doc_pair = if @book
                          @book.query_doc_pairs.sample
                        else
                          # grab any query_doc_pair that the judge has access to
                          QueryDocPair
                            .joins(book: { teams: :members })
                            .where(teams: { teams_members: { member_id: @ai_judge.id } })
                            .order('RAND()')
                            .first
                        end

      @query_doc_pair = QueryDocPair.new if @query_doc_pair.nil?
    end

    def update
      @ai_judge = User.find(params[:ai_judge_id])
      @ai_judge.update(ai_judge_params)

      @query_doc_pair = QueryDocPair.new(query_doc_pair_params)

      llm_service = LlmService.new(@ai_judge.openai_key, @ai_judge.judge_options)
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
      params.expect(user: [ :openai_key, :system_prompt ])
    end

    def query_doc_pair_params
      params.expect(query_doc_pair: [ :document_fields, :position, :query_text, :doc_id, :notes,
                                      :information_need, { options: {} } ])
    end
  end
end
