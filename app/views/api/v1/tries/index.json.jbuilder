# frozen_string_literal: true

json.tries do
  json.array! @tries, partial: 'try', as: :try
end
