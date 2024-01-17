# frozen_string_literal: true

json.all_books do
  json.array! @books, partial: 'book', as: :book
end
