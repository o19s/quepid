# frozen_string_literal: true

class QueryCollection < QuepidCollection
  model Query
  description 'One search string inside a case.'
  fields :id, :query_text, :information_need, :notes, :case, :created_at, :updated_at

  instructions <<~TXT
    A query is one search string evaluated inside a case. "query_text" is sent to the search
    engine; "information_need" describes what the searcher wanted and is often null. Its ratings
    are in "rating" ($match {"query": <id>}).
  TXT

  def scope_for user
    Query.where(case_id: visible_case_ids(user))
  end
end
