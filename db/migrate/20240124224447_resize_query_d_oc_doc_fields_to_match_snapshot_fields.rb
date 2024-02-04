class ResizeQueryDOcDocFieldsToMatchSnapshotFields < ActiveRecord::Migration[7.1]
  # discovered that we limit this to TEXT, not MEDIUMTEXT, however
  # in SnapshotDocs.fields it IS a MEDIUMTEXT field.
  def change
    change_column :query_doc_pairs, :document_fields, :mediumtext
  end
end
