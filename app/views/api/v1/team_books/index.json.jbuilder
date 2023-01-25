# frozen_string_literal: true

json.books do
  json.array! @books, partial: 'book', as: :book
end
