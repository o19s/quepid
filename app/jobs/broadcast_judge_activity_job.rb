# frozen_string_literal: true

# Broadcasts a real-time refresh of one judge's row in the Judge Activity
# table to anyone viewing the book overview page. Fired after every single
# judgement an AI judge saves while actively working through a book (see
# RunJudgeJudyJob), so this needs to touch only the row that actually
# changed - re-rendering the whole tbody on every pair judged was re-running
# *every* judge's sparkline chart too (each one a freshly generated Vega
# spec/div, since the Vega gem's wrapper div id is random per render - see
# _judge_activity_row.html.erb), which looked like every row in the table
# flickering in sync with however fast one AI judge happened to be working.
class BroadcastJudgeActivityJob < ApplicationJob
  queue_as :default

  def perform book, judge
    row = book.judge_activity_rows.find { |r| r[:judge].id == judge.id }

    # Falls back to a full-tbody update if the row isn't there yet to replace
    # (shouldn't normally happen - this only fires after judge has just
    # judged something, or while judge is an actively-running AI judge, both
    # of which judge_activity_rows already includes) - same reasoning as the
    # old whole-tbody-only approach: Turbo's "replace" silently no-ops for a
    # target that doesn't exist yet in a viewer's DOM, so falling back here
    # means a genuinely brand new row still appears instead of being lost
    # until the next poll/reload.
    if row
      Turbo::StreamsChannel.broadcast_replace_to(
        book.judgements_broadcast_channel,
        target:  "judge-row-#{judge.id}",
        partial: 'books/judge_activity_row',
        locals:  { row: row, flash_active: true, book: book }
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
