# frozen_string_literal: true

module AiJudges
  class PromptsController < ApplicationController
    def edit
      @ai_judge = User.find(params[:ai_judge_id])

      if params[:book_id]
        @book = Book.find(params[:book_id])
        @query_doc_pair = @book.query_doc_pairs.sample
      else
        # grab any query_doc_pair that the judge has access to
        @query_doc_pair = QueryDocPair
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

      llm_service = LlmService.new(@ai_judge.openai_key)
      @judgement = llm_service.make_judgement @ai_judge, @query_doc_pair
      pp @judgement

      render :edit
    end

    private

    # Only allow a list of trusted parameters through.
    def ai_judge_params
      params.expect(user: [ :openai_key, :prompt ])
    end

    def query_doc_pair_params
      params.require(:query_doc_pair).permit(:document_fields, :position, :query_text, :doc_id, :notes,
                                             :information_need, options: {})
    end
  end
end
