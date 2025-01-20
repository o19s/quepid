class AddLiveAsBooleanToAnnouncements < ActiveRecord::Migration[7.1]
  def change
    add_column :announcements, :live, :boolean, default: false
  end
end
