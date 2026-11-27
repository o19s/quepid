# frozen_string_literal: true

class AutoRunJudgeJudyJob < RunJudgeJudyJob
  limits_concurrency to:          1,
                     key:         ->(book, judge, *) { "run_judge_judy_#{book.id}_#{judge.id}" },
                     group:       'RunJudgeJudyJob',
                     duration:    30.minutes,
                     on_conflict: :block

  # A judge limited to other scales after it was put on the book would only be
  # refused, so it isn't queued at all.
  def self.enqueue_for assignment
    return unless assignment.ai_judge.supports_scale?(assignment.book.scale)

    assignment.with_lock do
      pending = active_for(assignment.book, assignment.ai_judge).any? do |job|
        job.class_name == name && !job.arguments['quepid_cancelled'] && job.claimed_execution.nil?
      end
      perform_later(assignment.book, assignment.ai_judge, nil) unless pending
    end
  end
end
