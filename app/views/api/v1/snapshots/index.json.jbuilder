# frozen_string_literal: true

json.snapshots do
  json.array! @snapshots, partial: 'snapshot', as: :snapshot, locals: { with_docs: false }
end
