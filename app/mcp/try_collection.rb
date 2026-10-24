# frozen_string_literal: true

class TryCollection < QuepidCollection
  model Try
  description 'One tuning iteration (query parameters) of a case.'
  fields :id, :try_number, :name, :case, :search_endpoint, :field_spec, :query_params,
         :number_of_rows, :escape_query, :created_at, :updated_at

  instructions <<~'TXT'
    One tuning iteration of a case: query parameters run against a search endpoint. try_number is
    unique within a case, so "the current try" is the case's highest try_number (it equals
    case.last_try_number), not the highest id. "query_params" is the query template, where
    #$query## is replaced by each query's text.
  TXT

  def scope_for user
    Try.where(case_id: visible_case_ids(user))
  end
end
