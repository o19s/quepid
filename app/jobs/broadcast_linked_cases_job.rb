# frozen_string_literal: true

# Broadcasts a real-time refresh of the Linked Cases card to anyone viewing
# the book overview page, so a case's sync-direction arrow starts/stops
# pulsing without a reload. Fired from PopulateBookJob (Case -> Book, at
# start/end and once per ~1% of batch progress), UpdateCaseJob (Book -> Case,
# start/end), JudgementFromRatingJob, and UpdateCaseRatingsJob (after each
# rating/judgement save syncs) - PopulateBookJob's per-progress-percent
# firing alone can mean dozens of enqueues a second for one book.
class BroadcastLinkedCasesJob < ApplicationJob
  queue_as :default

  # Every call site just re-renders the whole linked-cases card for the book,
  # so stacking more than one in flight for the same book is pure waste.
  # This isn't a periodic rate limit - it's a per-book mutex: a second
  # enqueue is discarded while one is still ready/running, and `duration` is
  # only a safety-valve TTL in case a held job never finishes (e.g. a stuck
  # worker), not a guarantee of "one every N seconds".
  limits_concurrency to:          1,
                     key:         ->(book) { "book_#{book.id}" },
                     duration:    5.seconds,
                     on_conflict: :discard

  def perform book
    Turbo::StreamsChannel.broadcast_update_to(
      book.judgements_broadcast_channel,
      target:  'linked-cases-list',
      partial: 'books/linked_cases_list',
      locals:  { book: book, cases: book.cases.includes(:owner) }
    )
  end
end
