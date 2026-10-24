# frozen_string_literal: true

module Analytics
  module Tracker
    module Book
      def track_query_doc_pairs_bulk_updated_event _user, book, empty = false
        if empty
          track 'Books', 'Populated empty book', label: book.name, value: book.id
        else
          track 'Books', 'Refreshed a book', label: book.name, value: book.id
        end
      end

      def track_book_shared_event _user, book, _team
        track 'Books', 'Shared a Book', label: book.name
      end
    end
  end
end
