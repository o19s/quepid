class AddAnnouncementViewedAnnouncementIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :announcement_viewed, :announcement_id, name: :index_announcement_viewed_announcement_id
  end
end
