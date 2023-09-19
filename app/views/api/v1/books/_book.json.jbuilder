# frozen_string_literal: true

export = @export ||= false

json.name        book.name
json.book_id     book.id unless export
json.show_rank   book.show_rank
json.support_implicit_judgements book.support_implicit_judgements

if export
  if book.scorer.present?
    json.scorer do
      json.partial! 'api/v1/scorers/scorer', scorer: book.scorer, export: export
    end
  end

  if book.selection_strategy.present?
    json.selection_strategy do
      json.partial! 'selection_strategy', selection_strategy: book.selection_strategy
    end
  end
end

json.query_doc_pairs do
  json.array! book.query_doc_pairs,
              partial: 'api/v1/books/query_doc_pairs', as: :query_doc_pair,
              export: export
end
