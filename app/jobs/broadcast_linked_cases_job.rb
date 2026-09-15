# frozen_string_literal: true

# Broadcasts a real-time refresh of the Linked Cases card to anyone viewing
# the book overview page. Fired when a PopulateBookJob (Case -> Book) or
# UpdateCaseJob (Book -> Case) starts or finishes, so the sync-direction
# arrow for the affected case starts/stops pulsing without a reload.
class BroadcastLinkedCasesJob < ApplicationJob
  queue_as :default

  def perform book
    Turbo::StreamsChannel.broadcast_update_to(
      "book_#{book.id}_judgements",
      target:  'linked-cases-list',
      partial: 'books/linked_cases_list',
      locals:  { book: book, cases: book.cases.includes(:owner) }
    )
  end
end
