# frozen_string_literal: true

# Broadcasts a real-time refresh of one judge's row in the Judge Activity
# table to anyone viewing the book overview page. Fired after every single
# judgement an AI judge saves while actively working through a book (see
# RunJudgeJudyJob).
#
# Only replaces the status and count cells - the sparkline chart
# (judge-sparkline-#{judge.id}) is deliberately never a broadcast target, so
# it's never torn down and re-embedded on every judgement. judge_count_cell
# carries the fresh values to that already-mounted chart instead (see
# judge_activity_stats_controller.js).
class BroadcastJudgeActivityJob < ApplicationJob
  queue_as :default

  def perform book, judge
    row = book.judge_activity_row_for(judge)

    # Falls back to a full-tbody update if the row isn't there yet to replace
    # (shouldn't normally happen - this only fires after judge has just
    # judged something, or while judge is an actively-running AI judge, both
    # of which judge_activity_rows already includes) - Turbo's "replace"
    # silently no-ops for a target that doesn't exist yet in a viewer's DOM,
    # so falling back here means a genuinely brand new row still appears
    # instead of being lost until the next poll/reload.
    if row
      Turbo::StreamsChannel.broadcast_replace_to(
        book.judgements_broadcast_channel,
        target:  "judge-status-#{judge.id}",
        partial: 'books/judge_status_cell',
        locals:  { row: row, flash_active: true, book: book }
      )
      Turbo::StreamsChannel.broadcast_replace_to(
        book.judgements_broadcast_channel,
        target:  "judge-count-#{judge.id}",
        partial: 'books/judge_count_cell',
        locals:  { row: row }
      )
      Turbo::StreamsChannel.broadcast_replace_to(
        book.judgements_broadcast_channel,
        target:  "judge-last-#{judge.id}",
        partial: 'books/judge_last_cell',
        locals:  { row: row }
      )
    else
      Turbo::StreamsChannel.broadcast_update_to(
        book.judgements_broadcast_channel,
        target:  'judge-activity-table',
        partial: 'books/judge_activity_table_body',
        locals:  { judge_activity: book.judge_activity_rows,
                   book: book, flashing_judge_id: judge.id }
      )
    end
  end
end
