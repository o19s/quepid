import { prettyPrintJson } from "utils/json_format"

// Wrongly-cased Solr params, matched case-sensitively anywhere in the text.
const SOLR_PARAM_TYPOS = Object.entries({
  deftype: "defType",
  echoparams: "echoParams",
  explainother: "explainOther",
  logparamslist: "logParamsList",
  omitheader: "omitHeader",
  segmentterminateearly: "segmentTerminateEarly",
  timeallowed: "timeAllowed"
})

export function queryParamsMode(value) {
  try {
    JSON.parse(value || "")
    return "json"
  } catch {
    return "text"
  }
}

/**
 * The first known Solr parameter typo in the query params, or null.
 * @param {string} [value]
 * @returns {{ typo: string, correction: string } | null}
 */
export function queryParamsWarning(value) {
  const text = value || ""
  const match = SOLR_PARAM_TYPOS.find(([typo]) => text.includes(typo))
  return match ? { typo: match[0], correction: match[1] } : null
}

export function formatJson(value) {
  try {
    return prettyPrintJson(value)
  } catch {
    return null
  }
}

export function validateNumberOfRows(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 100
}

export function urlBucket(url, urls) {
  const index = urls.indexOf(url)
  return (index === -1 ? urls.length : index) % 3
}

// History row hover text: the search URL, then one `name=value` line per tuning knob.
export function historyTitle(aTry) {
  const vars = (aTry.curatorVars || [])
    .map((variable) => `${variable.name}=${variable.value}\n`)
    .join("")
  return `${aTry.searchUrl || ""}\n${vars}`
}

export function curatorVariableEntries(variables) {
  return (variables || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.inQueryParams)
}

// JSON field definitions are indivisible, including commas and spaces inside strings/options.
export function fieldSpecTokens(value = "") {
  const fields = []
  let token = ""
  let depth = 0
  let quoted = false
  let escaped = false
  for (const char of value) {
    if (!quoted && depth === 0 && /[,\s+]/.test(char)) {
      if (token) fields.push(token)
      token = ""
      continue
    }
    token += char
    if (quoted) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') quoted = false
    } else if (depth > 0 && char === '"') quoted = true
    else if (char === "{" && (depth > 0 || token.length === 1)) depth += 1
    else if (char === "}" && depth > 0) depth -= 1
  }
  if (token) fields.push(token)
  return fields
}
