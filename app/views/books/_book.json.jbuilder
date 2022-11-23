json.extract! book, :id, :team_id, :scorer_id, :selection_strategy_id, :name, :created_at, :updated_at
json.url book_url(book, format: :json)
