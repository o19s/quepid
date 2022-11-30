json.extract! query_doc_pair, :id, :user_id, :query_text, :rank, :document_fields, :book_id, :created_at, :updated_at, :doc_id
json.url query_doc_pair_url(query_doc_pair, format: :json)
