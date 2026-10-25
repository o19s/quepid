import { relative } from "node:path"

function propertyName(node) {
  return node?.computed ? node.property?.value : node?.property?.name
}

export default {
  meta: {
    type: "suggestion",
    schema: [{ type: "object", additionalProperties: { type: "object" } }],
    messages: {
      increase: "{{kind}} exceeds this controller's recorded baseline. Use Stimulus data-action or an ERB shell with targets; document any required exception."
    }
  },
  create(context) {
    const filename = relative(context.cwd, context.filename).replaceAll("\\", "/")
    const allowance = context.options[0]?.[filename] || {}
    const sites = { documentListener: [], innerHTML: [] }
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type === "MemberExpression" &&
            callee.object.type === "Identifier" && callee.object.name === "document" &&
            propertyName(callee) === "addEventListener") {
          sites.documentListener.push(node)
        }
      },
      AssignmentExpression(node) {
        if (node.left.type === "MemberExpression" && propertyName(node.left) === "innerHTML") {
          sites.innerHTML.push(node)
        }
      },
      "Program:exit"() {
        for (const [kind, nodes] of Object.entries(sites)) {
          for (const node of nodes.slice(allowance[kind] || 0)) {
            context.report({ node, messageId: "increase", data: { kind } })
          }
        }
      }
    }
  }
}
