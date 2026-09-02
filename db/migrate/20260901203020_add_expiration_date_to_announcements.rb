# frozen_string_literal: true

class AddExpirationDateToAnnouncements < ActiveRecord::Migration[8.1]
  def up
    add_column :announcements, :expiration_date, :date

    # Backfill existing announcements so the NOT NULL constraint below doesn't
    # orphan them - yesterday's date means they read as already-expired (expired?
    # uses a strict '<', so today's date would not count yet) until an admin
    # explicitly extends them, which is the safe default. A later migration
    # backfills publish_date to DATE(created_at); using GREATEST here keeps
    # expiration_date >= that value for announcements created earlier today,
    # so the publish_date <= expiration_date invariant always holds.
    Announcement.where(expiration_date: nil)
      .update_all('expiration_date = GREATEST(DATE(created_at), DATE_SUB(CURDATE(), INTERVAL 1 DAY))')

    change_column_null :announcements, :expiration_date, false
  end

  def down
    remove_column :announcements, :expiration_date
  end
end
