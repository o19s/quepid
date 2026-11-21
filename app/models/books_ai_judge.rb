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
  belongs_to :ai_judge, class_name: 'AiJudge', foreign_key: 'user_id'

  scope :auto_run, -> { where(auto_run: true) }

  # Only on create: a judge already on a book stays, so limiting a judge later
  # never blocks unrelated edits to its books (RunJudgeJudyJob refuses to run it).
  validate :judge_supports_book_scale, on: :create

  private

  def judge_supports_book_scale
    return if ai_judge.nil? || book.nil? || ai_judge.supports_scale?(book.scale)

    errors.add(:base, "#{ai_judge.name} can't rate on this book's scale")
  end
end
