class CreateAnnouncements < ActiveRecord::Migration[7.0]
  def change
    create_table :announcements do |t|
      t.string :text
      t.integer :author_id

      t.timestamps
    end
  end
end
