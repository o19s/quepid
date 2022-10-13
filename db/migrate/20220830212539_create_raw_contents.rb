class CreateRawContents < ActiveRecord::Migration[6.1]
  def change
    create_table :raw_contents do |t|
      t.text :content
      t.integer :try_id

      t.timestamps
    end
  end
end
