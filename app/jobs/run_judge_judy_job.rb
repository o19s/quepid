# frozen_string_literal: true

class RunJudgeJudyJob < ApplicationJob
  queue_as :default

  # Performs AI judging on query/document pairs
  #
  # @param book [Book] The book containing query-doc pairs to judge
  # @param judge [User] The AI judge user performing the ratings
  # @param number_of_pairs [Integer, nil] Number of pairs to judge, nil for all pairs
  #
  # @example Judge 10 pairs
  #   RunJudgeJudyJob.perform_later(book, ai_judge, 10)
  #
  # @example Judge all pairs
  #   RunJudgeJudyJob.perform_later(book, ai_judge, nil)
  def perform book, judge, number_of_pairs
    counter = 0
    llm_service = LlmService.new judge.llm_key, judge.judge_options
    loop do
      break if number_of_pairs && counter >= number_of_pairs

      query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, judge)
      break if query_doc_pair.nil?

      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge)

      llm_service.perform_safe_judgement(judgement, book: book)

      if judgement.rating.blank?
        # if we don't have a rating, let's assume it's not rateable and mark it so.
        judgement.mark_unrateable
      elsif book.scale.present? && book.scale.map(&:to_f).exclude?(judgement.rating.to_f)
        # the LLM returned a rating outside this book's configured scale -- a
        # human judge could never produce this (the judging UI only offers
        # buttons for the book's actual scale values), so don't trust it, but
        # keep the raw value visible for review rather than silently dropping it.
        # (A book with no scale configured at all is left alone here -- there's
        # nothing to validate against, so its rating passes through as-is.)
        judgement.explanation = "#{judgement.explanation} [LLM returned rating #{judgement.rating.inspect}, outside this book's scale #{book.scale.inspect}]".strip
        judgement.mark_unrateable
      end

      judgement.save!
      counter += 1

      if number_of_pairs.nil?
        broadcast_update_kraken_mode(book, counter, query_doc_pair, judge)
      else
        broadcast_update(book, number_of_pairs - counter, query_doc_pair, judge)
      end
    end
    broadcast_complete(book, judge)
    UpdateCaseJob.perform_later book
  end

  private

  def broadcast_update book, counter, query_doc_pair, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/blah',
      locals:  { book: book, counter: counter, qdp: query_doc_pair, judge: judge }
    )
  end

  def broadcast_update_kraken_mode book, counter, query_doc_pair, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/update_kraken_mode',
      locals:  { book: book, counter: counter, qdp: query_doc_pair, judge: judge }
    )
  end

  def broadcast_complete book, judge
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/complete',
      locals:  { book: book, judge: judge }
    )
  end
end
