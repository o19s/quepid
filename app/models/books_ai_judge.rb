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
class BooksAiJudge < ApplicationRecord
  belongs_to :book
  # rubocop:disable-next Rails/InverseOf -- User has no corresponding has_many; not needed on that side.
  belongs_to :ai_judge, class_name: 'User', foreign_key: 'user_id'

  scope :auto_run, -> { where(auto_run: true) }
end
