# frozen_string_literal: true

json.name        book.name
json.show_rank   book.show_rank
json.support_implicit_judgements book.support_implicit_judgements

if book.scorer.present?
  json.scorer do
    json.partial! 'api/v1/scorers/scorer', scorer: book.scorer, export: true
  end
end

if book.selection_strategy.present?
  json.selection_strategy do
    json.partial! 'selection_strategy', selection_strategy: book.selection_strategy
  end
end

json.query_doc_pairs do
  json.array! book.query_doc_pairs,
              partial: 'query_doc_pair', as: :query_doc_pair
end
