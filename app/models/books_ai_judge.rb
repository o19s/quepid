# frozen_string_literal: true

# == Schema Information
#
# Table name: books_ai_judges
#
#  id         :bigint           not null, primary key
#  auto_run   :boolean          default(FALSE), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  book_id    :bigint           not null
#  user_id    :bigint           not null
#
# Indexes
#
#  index_books_ai_judges_on_book_id              (book_id)
#  index_books_ai_judges_on_book_id_and_user_id  (book_id,user_id) UNIQUE
#  index_books_ai_judges_on_user_id              (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (book_id => books.id)
#
class BooksAiJudge < ApplicationRecord
  belongs_to :book
  # rubocop:disable-next Rails/InverseOf -- User has no corresponding has_many; not needed on that side.
  belongs_to :ai_judge, class_name: 'User', foreign_key: 'user_id'

  scope :auto_run, -> { where(auto_run: true) }
end
