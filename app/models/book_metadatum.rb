# frozen_string_literal: true

# == Schema Information
#
# Table name: book_metadata
#
#  id             :bigint           not null, primary key
#  last_viewed_at :datetime
#  book_id        :bigint           not null
#  user_id        :integer
#
# Indexes
#
#  index_book_metadata_on_book_id              (book_id)
#  index_book_metadata_on_user_id_and_book_id  (user_id,book_id)
#
# Foreign Keys
#
#  fk_rails_...  (book_id => books.id)
#
class BookMetadatum < ApplicationRecord
  belongs_to :book
  belongs_to :user
end
