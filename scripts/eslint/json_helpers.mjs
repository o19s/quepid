// Enforces the `api/json` verb-helper convention (DEVELOPER_GUIDE § Stimulus HTTP
// conventions): pick the helper for the HTTP verb instead of passing `method`.
const OPTIONS_INDEX = { getJson: 1, postJson: 2, putJson: 2, patchJson: 2, deleteJson: 2 }

export default {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      method: "Don't pass `method` to {{helper}}; use the api/json helper named for the verb (getJson, postJson, putJson, patchJson, deleteJson)."
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        const helper = node.callee.type === "Identifier" ? node.callee.name : null
        const index = OPTIONS_INDEX[helper]
        const options = index === undefined ? null : node.arguments[index]
        if (options?.type !== "ObjectExpression") return
        const method = options.properties.find(
          (property) => property.type === "Property" && !property.computed &&
            (property.key.name === "method" || property.key.value === "method")
        )
        if (method) context.report({ node: method, messageId: "method", data: { helper } })
      }
    }
  }
}
