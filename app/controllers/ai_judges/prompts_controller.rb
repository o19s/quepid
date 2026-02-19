# frozen_string_literal: true

module AiJudges
  class PromptsController < ApplicationController
    before_action :set_book
    before_action :set_ai_judge

    def show
      redirect_to edit_ai_judge_prompt_path(params[:ai_judge_id], @book)
    end

    def edit
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
      @ai_judge.update(ai_judge_params)

      @query_doc_pair = QueryDocPair.new(query_doc_pair_params)

      llm_service = LlmService.new(@ai_judge.llm_key, @ai_judge.judge_options)
      @judgement = Judgement.new(query_doc_pair: @query_doc_pair, user: @ai_judge)
      llm_service.perform_safe_judgement @judgement

      render :edit
    end

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
    end

    def set_ai_judge
      accessible_book_ids = current_user.books_involved_with.select(:id)
      @ai_judge = User.joins('INNER JOIN books_ai_judges ON books_ai_judges.user_id = users.id')
                       .where(books_ai_judges: { book_id: accessible_book_ids })
                       .where(users: { id: params[:ai_judge_id] })
                       .first

      return if @ai_judge

      flash[:alert] = 'AI judge not found.'
      redirect_to root_path
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
