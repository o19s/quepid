class AddAnnouncementsLiveIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :announcements, :live, name: :index_announcements_live, unique: true
  end
end
