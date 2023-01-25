class AddFieldsToSnapshotDocs < ActiveRecord::Migration[6.1]
  def change
    add_column :snapshot_docs, :fields, :text, size: :medium, collation: "utf8mb4_general_ci"
  end
end
