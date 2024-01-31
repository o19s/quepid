class CreateAnnouncementVieweds < ActiveRecord::Migration[7.0]
  def change
    create_table :announcement_vieweds do |t|
      t.integer :announcement_id
      t.integer :user_id

      t.timestamps
    end
  end
end
