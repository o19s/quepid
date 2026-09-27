export function buildQueryDocPairsPayload(queries) {
  return queries.flatMap((query) =>
    (query.docs || []).map((doc, index) => {
      const fields = Object.values(doc.subsList || {}).reduce((result, field) => {
        result[field.field] = field.value
        return result
      }, {})

      fields.title = doc.title

      if (doc.doc?.title !== undefined && doc.doc.title !== doc.title) {
        fields.title_field = doc.doc.title
      }

      if (doc.hasThumb?.()) {
        fields.thumb = doc.thumb_options?.prefix
          ? `${doc.thumb_options.prefix}${doc.thumb}`
          : doc.thumb
      }

      if (doc.hasImage?.()) {
        fields.image = doc.image_options?.prefix
          ? `${doc.image_options.prefix}${doc.image}`
          : doc.image
      }

      return {
        query_text: query.queryText,
        doc_id: doc.id,
        position: index + 1,
        document_fields: fields
      }
    })
  )
}
