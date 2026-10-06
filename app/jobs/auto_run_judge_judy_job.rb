# frozen_string_literal: true

class AutoRunJudgeJudyJob < RunJudgeJudyJob
  limits_concurrency to:          1,
                     key:         ->(book, judge, *) { "run_judge_judy_#{book.id}_#{judge.id}" },
                     group:       'RunJudgeJudyJob',
                     duration:    30.minutes,
                     on_conflict: :block

  def self.enqueue_for assignment
    assignment.with_lock do
      pending = active_for(assignment.book, assignment.ai_judge).any? do |job|
        job.class_name == name && !job.arguments['quepid_cancelled'] && job.claimed_execution.nil?
      end
      perform_later(assignment.book, assignment.ai_judge, nil) unless pending
    end
  end
end
