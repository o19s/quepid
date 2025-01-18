class AddAllQueryAttributesToQueryDocs < ActiveRecord::Migration[7.1]
  # As we do more automatic syncing of books and cases it becomes more
  # apparent that having "query" and "ratings" as separate tables for supporting Cases,
  # while having "query_doc_pair" and "judgements" for supporting Books is
  # maybe not the right way.   
  # 
  # Here we are adding some columns to "query_doc_pair" that exist on "query"
  # so that when we have a Case, and we populate the Book, and then
  # create a NEW Case, we have these fields from the original Case.
  def change
    add_column :query_doc_pairs, :information_need, :string
    add_column :query_doc_pairs, :notes, :text
    add_column :query_doc_pairs, :options, :text
  end
end
