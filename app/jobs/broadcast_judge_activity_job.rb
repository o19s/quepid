# frozen_string_literal: true

# Cell updates keep mounted sparkline charts alive. Polling supplies missing rows
# after a missed subscription and reconciles removed judges.
class BroadcastJudgeActivityJob < ApplicationJob
  queue_as :default

  def perform book, judge
    row = book.judge_activity_row_for(judge)
    # Coverage is the same for every viewer, so render it once.
    coverage_html = ApplicationController.render(
      partial: 'books/coverage_summary', locals: book.coverage_summary.merge(cases: book.cases)
    )
    member_ids = book.teams.joins(:members).pluck('teams_members.member_id')
    User.where(id: [ book.owner_id, *member_ids ].compact.uniq).find_each do |viewer|
      channel = [ viewer, book, :judgements ]
      Turbo::StreamsChannel.broadcast_update_to(*channel, target: 'book-coverage-summary', html: coverage_html)
      if row
        row[:refinable] = AiJudge.for_user(viewer).exists?(id: judge.id)
        broadcast_cells(channel, book, row)
        if 1 == row[:count] && !judge.ai_judge?
          Turbo::StreamsChannel.broadcast_remove_to(*channel, target: 'judge-activity-empty')
          Turbo::StreamsChannel.broadcast_append_to(
            *channel, target: 'judge-activity-table', partial: 'books/judge_activity_row',
            locals: { row: row, book: book, flash_active: true }
          )
        end
      else
        Turbo::StreamsChannel.broadcast_remove_to(*channel, target: "judge-row-#{judge.id}")
      end
    end
  end

  private

  def broadcast_cells channel, book, row
    { status: 'judge_status_cell', count: 'judge_count_cell', last: 'judge_last_cell' }.each do |cell, partial|
      locals = :status == cell ? { row: row, book: book, flash_active: true } : { row: row }
      Turbo::StreamsChannel.broadcast_replace_to(
        *channel, target: "judge-#{cell}-#{row[:judge].id}", partial: "books/#{partial}", locals: locals
      )
    end
  end
end
