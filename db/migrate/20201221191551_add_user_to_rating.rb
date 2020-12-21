class AddUserToRating < ActiveRecord::Migration[5.2]
  def change
    add_reference :ratings, :user, foreign_key: true, type: :integer
  end
end
