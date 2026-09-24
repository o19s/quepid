# frozen_string_literal: true

# Decides whether a judgement an AI judge produced is usable, and marks it
# unrateable when it isn't.
#
# One definition, because more than one caller needs it: the bulk judging job
# today, the prompt preview and (when it exists) batch ingest tomorrow. A rating
# that would be rejected in a run should look rejected everywhere.
class JudgementFinalizer
  def self.call judgement, book: nil
    new(judgement, book: book).call
  end

  def initialize judgement, book: nil
    @judgement = judgement
    @book = book
    @scale = JudgeScale.for(book)
  end

  def call
    if judgement.rating.blank?
      # if we don't have a rating, let's assume it's not rateable and mark it so.
      judgement.mark_unrateable
    elsif out_of_scale?
      annotate_out_of_scale
      judgement.mark_unrateable
    end

    judgement
  end

  private

  attr_reader :judgement, :book, :scale

  # A book with no scale configured at all is left alone -- there's nothing to
  # validate against, so its rating passes through as-is.
  def out_of_scale?
    scale.present? && !scale.includes?(judgement.rating)
  end

  # The LLM returned a rating outside this book's configured scale -- a human
  # judge could never produce this (the judging UI only offers buttons for the
  # book's actual scale values), so don't trust it, but keep the raw value
  # visible for review rather than silently dropping it. Runs before
  # mark_unrateable, which clears the rating.
  def annotate_out_of_scale
    judgement.explanation =
      "#{judgement.explanation} [LLM returned rating #{judgement.rating.inspect}, " \
      "outside this book's scale #{book.scale.inspect}]".strip
  end
end
