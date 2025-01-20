class FixTableEncodingForAnnouncementsText < ActiveRecord::Migration[8.0]
  def change
    change_column :announcements, :text, :text, charset: :utf8mb4, collation: :utf8mb4_unicode_ci
  end
end
