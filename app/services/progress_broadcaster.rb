# frozen_string_literal: true

class ProgressBroadcaster
  def self.render record, partial:, locals:, target: 'notifications'
    member_ids = record.teams.joins(:members).pluck('teams_members.member_id')
    User.where(id: [ record.owner_id, *member_ids ].compact.uniq).find_each do |user|
      Turbo::StreamsChannel.broadcast_render_to(
        user, :notifications, target: target, partial: partial, locals: locals
      )
    end
  end

  def initialize book, total
    @book = book
    @total = total
    @last_percent = 0
  end

  def advance counter, query_doc_pair
    return if @total.zero?

    percent = (((@total - counter).to_f / @total) * 100).truncate
    return unless percent > @last_percent

    @last_percent = percent
    self.class.render(@book, partial: 'books/blah', locals: {
      book: @book, counter: counter, percent: percent, qdp: query_doc_pair
    })
  end
end
