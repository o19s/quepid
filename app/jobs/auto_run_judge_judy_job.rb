# frozen_string_literal: true

class AutoRunJudgeJudyJob < RunJudgeJudyJob
  limits_concurrency to:          1,
                     key:         ->(book, judge, *) { "run_judge_judy_#{book.id}_#{judge.id}" },
                     group:       'RunJudgeJudyJob',
                     duration:    30.minutes,
                     on_conflict: :block

  # A judge that would only be refused (AiJudge#judging_problem) isn't queued at all.
  def self.enqueue_for assignment
    book = assignment.book
    judge = assignment.ai_judge
    return if judge.judging_problem(book.scale)

    assignment.with_lock do
      pending = active_for(book, judge).any? do |job|
        job.class_name == name && !job.arguments['quepid_cancelled'] && job.claimed_execution.nil?
      end
      perform_later(book, judge, nil) unless pending
    end
  end
end
