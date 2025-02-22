class EnsureNotUniqueLiveAnnoucementsIndex < ActiveRecord::Migration[8.0]
  def change
    # make sure that the non-unique index is removed and created as just a index
    remove_index :announcements, name: "index_announcements_live"
    add_index :announcements, :live
  end
end
