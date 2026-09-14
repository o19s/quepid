# frozen_string_literal: true

# Broadcasts a real-time judge activity row update to anyone viewing the book overview page.
# Fired after a judgement is saved so the RE overview updates without a page reload.
class BroadcastJudgeActivityJob < ApplicationJob
  queue_as :default

  def perform book, judge, actively_judging: nil
    activity = book.judge_activity_for([ judge.id ]).fetch(judge.id, { sparkline: [], count: 0, last_judged_at: nil })
    is_actively_judging = actively_judging.nil? ? RunJudgeJudyJob.actively_judging?(book, judge) : actively_judging

    Turbo::StreamsChannel.broadcast_replace_to(
      "book_#{book.id}_judgements",
      target:  "judge-row-#{judge.id}",
      partial: 'books/judge_activity_row',
      locals:  {
        book:         book,
        row:          {
          judge:            judge,
          sparkline:        activity[:sparkline],
          last_judged_at:   activity[:last_judged_at],
          count:            activity[:count],
          actively_judging: is_actively_judging,
        },
        flash_active: true,
      }
    )
  end
end
