# frozen_string_literal: true

no_doc_data ||= true

json.name        book.name
json.book_id     book.id
json.show_rank   book.show_rank
json.support_implicit_judgements book.support_implicit_judgements
json.scorer_id   book.scorer_id
json.scorer_name book.scorer.name if book.scorer.present?
json.selection_strategy_id book.selection_strategy_id
json.selection_strategy book.selection_strategy.name

json.query_doc_pairs do
  json.array! book.query_doc_pairs,
              partial: 'api/v1/books/query_doc_pairs', as: :query_doc_pair,
              no_doc_data: no_doc_data
end
