# frozen_string_literal: true

json.books do
  json.array! @books do |book|
    json.name        book.name
    json.id          book.id
  end
end

json.books_count current_user.books_involved_with.count
