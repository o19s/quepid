# frozen_string_literal: true

json.id doc.doc_id

if doc.fields.present?
  JSON.parse(doc.fields).map do |key, value|
    json.set! key, value
  end
end
