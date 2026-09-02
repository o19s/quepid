# frozen_string_literal: true

class AddPublishDateToAnnouncementsRemoveLive < ActiveRecord::Migration[8.1]
  def up
    add_column :announcements, :publish_date, :date

    # Existing announcements read as "already published" as of when they were created -
    # expiration_date (added separately) is what actually governs whether they still show.
    Announcement.update_all('publish_date = DATE(created_at)')

    change_column_null :announcements, :publish_date, false

    remove_column :announcements, :live, :boolean, default: false
  end

  def down
    add_column :announcements, :live, :boolean, default: false
    add_index :announcements, :live, name: 'index_announcements_on_live'

    remove_column :announcements, :publish_date
  end
end
