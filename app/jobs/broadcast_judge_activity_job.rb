# frozen_string_literal: true

# Broadcasts a real-time refresh of the whole Judge Activity table to anyone
# viewing the book overview page. Fired after a judgement is saved so the RE
# overview updates without a page reload.
class BroadcastJudgeActivityJob < ApplicationJob
  queue_as :default

  # The whole table is re-rendered fresh (not just judge's row) - re-rendering
  # a single row via Turbo's "replace" silently no-ops if that row didn't
  # exist yet in a viewer's DOM (e.g. a book's very first-ever judgement), so
  # a viewer would never see it appear until a reload. Updating the whole
  # tbody's contents instead means the target (the tbody itself) always
  # exists once the page has rendered at all, so a brand new judge's row
  # always shows up live. judge is still passed through so only their row
  # gets the "just updated" flash animation, not every row in the table.
  def perform book, judge
    Turbo::StreamsChannel.broadcast_update_to(
      "book_#{book.id}_judgements",
      target:  'judge-activity-table',
      partial: 'books/judge_activity_table_body',
      locals:  { judge_activity: book.judge_activity_rows, book: book, flashing_judge_id: judge.id }
    )
  end
end
