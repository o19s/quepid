class ChangeAnnouncementTextFieldLength < ActiveRecord::Migration[7.1]
  def change
    change_column :announcements, :text, :text, limit: 1024
  end
end
