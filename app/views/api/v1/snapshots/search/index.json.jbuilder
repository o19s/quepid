# frozen_string_literal: true

json.responseHeader do
  json.status 2
  json.QTime 0

  json.params do
    json.q @q
  end
end

json.response do
  json.numFound @snapshot_docs.count
  json.start 0
  json.numFoundExact true
  json.docs do
    json.array! @snapshot_docs, partial: 'doc', as: :doc, locals: {}
  end
end
