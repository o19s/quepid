# frozen_string_literal: true

# Jev judgements made before ADR 0008 kept their confidence only in the explanation the Jev
# adapter writes ("Jev rated 1 -- raw score 0.57 of 0-1, confidence 0.35. Distribution: ...").
# Read it back. Matched on the text, not on the judge's current provider, since a judge can change
# connection. An escalated judgement's explanation opens with a note quoting the judgement it
# answers (RunJudgeJudyJob#escalation_note), so only what follows that note is read. The note is
# found by its text, because the link to the source is nulled when the source is deleted.
class BackfillJudgementConfidenceFromJevExplanations < ActiveRecord::Migration[8.1]
  class Judgement < ActiveRecord::Base
    self.table_name = 'judgements'
  end

  CONFIDENCE = /\AJev rated .*? -- (?:raw score \S+ of \S+, )?confidence (\S+?)\. Distribution:/m

  def up
    Judgement.where(confidence: nil).where('explanation LIKE ?', '%Jev rated %').find_each do |judgement|
      confidence = self.class.confidence_in(judgement.explanation)
      judgement.update_column(:confidence, confidence) if confidence
    end
  end

  def down
    # The explanations are untouched, so there is nothing to restore.
  end

  def self.confidence_in explanation
    text = explanation.to_s
    text = text.split("\n\n", 2).last.to_s if text.start_with?('Escalated from ') && text.include?("\n\n")
    raw = text[CONFIDENCE, 1]
    return unless raw

    number = Float(raw)
    number if number.finite? && number.between?(0, 1)
  rescue ArgumentError, TypeError
    nil
  end
end
