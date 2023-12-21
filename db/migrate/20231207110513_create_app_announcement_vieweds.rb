class CreateAppAnnouncementVieweds < ActiveRecord::Migration[7.0]
  def change
    create_table :app_announcement_vieweds do |t|
      t.integer :app_announcement_id
      t.integer :user_id

      t.timestamps
    end
  end
end
