class AddAnnouncementsAuthorIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :announcements, :author_id, name: :index_announcements_author_id
  end
end
