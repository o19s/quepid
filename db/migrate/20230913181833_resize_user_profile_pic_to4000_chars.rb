class ResizeUserProfilePicTo4000Chars < ActiveRecord::Migration[7.0]
  def change
    change_column :users, :profile_pic, :string, :limit => 4000
  end
end
