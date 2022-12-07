# frozen_string_literal: true

json.array! @books, partial: 'books/book', as: :book
