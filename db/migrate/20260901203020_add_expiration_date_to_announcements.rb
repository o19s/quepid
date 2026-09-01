# frozen_string_literal: true

class AddExpirationDateToAnnouncements < ActiveRecord::Migration[8.1]
  def up
    add_column :announcements, :expiration_date, :date

    # Backfill existing announcements so the NOT NULL constraint below doesn't
    # orphan them - today's date means they read as already-expired until an
    # admin explicitly extends them, which is the safe default.
    Announcement.where(expiration_date: nil).update_all(expiration_date: Date.current)

    change_column_null :announcements, :expiration_date, false
  end

  def down
    remove_column :announcements, :expiration_date
  end
end
