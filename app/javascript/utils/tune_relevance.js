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

export function curatorVariableEntries(variables) {
  return (variables || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.inQueryParams)
}
