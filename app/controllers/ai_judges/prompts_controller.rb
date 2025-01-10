# frozen_string_literal: true

module AiJudges
  class PromptsController < ApplicationController
    def edit
      @ai_judge = User.find(params[:ai_judge_id])

      if params[:book_id]
        @book = Book.find(params[:book_id])
        @query_doc_pair = @book.query_doc_pairs.sample
      else
        @query_doc_pair = @ai_judge.teams
          .flat_map(&:books)
          .flat_map(&:query_doc_pairs)
          .sample
      end

      @query_doc_pair = QueryDocPair.new if @query_doc_pair.nil?
    end

    def update
      @ai_judge = User.find(params[:ai_judge_id])
      @ai_judge.update(ai_judge_params)

      # Hey scott, here we make a call!
      llm_service = LlmService.new(@ai_judge.openai_key)
      result = llm_service.make_judgement @ai_judge.prompt, 'user prompt'
      pp result

      @query_doc_pair = QueryDocPair.new(query_doc_pair_params)

      @judgement = Judgement.new
      @judgement.rating = result[:rating]
      @judgement.explanation = result[:explanation]

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
