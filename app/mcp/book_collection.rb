# frozen_string_literal: true

class BookCollection < QuepidCollection
  model Book
  description 'A reusable corpus of query/document judgements.'
  fields :id, :name, :archived, :scale, :scale_with_labels, :scoring_guidelines,
         :support_implicit_judgements, :show_rank, :rank_depth, :created_at, :updated_at

  computed :owner_id, :integer, sql: '{table}.owner_id', doc: 'id of the owning user (no user collection)'
  computed :query_doc_pair_count, :integer,
           sql: 'SELECT count(*) FROM query_doc_pairs WHERE query_doc_pairs.book_id = {table}.id',
           doc: 'number of query/document pairs in the book'

  instructions <<~TXT
    A book is a reusable corpus of query/document judgements shared across cases. Its pairs are in
    "query_doc_pair" ($match {"book": <id>}), the verdicts on them in "judgement". "scale" is the
    rating scale (stored as text, e.g. "[0,1,2,3]"); "scale_with_labels" maps values to labels.
  TXT

  def scope_for user
    user.books_involved_with
  end
end
