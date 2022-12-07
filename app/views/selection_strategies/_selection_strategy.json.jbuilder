# frozen_string_literal: true

json.extract! selection_strategy, :id, :name, :created_at, :updated_at
json.url selection_strategy_url(selection_strategy, format: :json)
