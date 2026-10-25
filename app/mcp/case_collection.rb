# frozen_string_literal: true

class CaseCollection < QuepidCollection
  model Case
  description 'A relevance-testing workspace: queries evaluated against a search endpoint.'
  fields :id, :case_name, :last_try_number, :archived, :public, :nightly, :book,
         :created_at, :updated_at

  computed :owner_id, :integer, sql: '{table}.owner_id', doc: 'id of the owning user (no user collection)'
  computed :scorer_id, :integer, sql: '{table}.scorer_id', doc: 'id in the scorer collection'
  computed :query_count, :integer,
           sql: 'SELECT count(*) FROM queries WHERE queries.case_id = {table}.id',
           doc: 'number of queries in the case'

  instructions <<~TXT
    A case is a relevance-testing workspace: a named set of search queries evaluated against a
    search endpoint. Its queries are in "query" ($match {"case": <id>}); the ratings on those
    queries are in "rating". "book" references the book the case draws judgements from.
    "scorer_id" is a raw id: resolve it with a separate query on "scorer" ($match {"id": <value>}).
    "last_try_number" is the newest try's try_number. Archived cases are hidden in the UI.
  TXT

  def scope_for user
    user.cases_involved_with
  end
end
