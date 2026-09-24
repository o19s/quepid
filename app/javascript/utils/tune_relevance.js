const SOLR_PARAM_TYPOS = {
  deftype: "defType",
  echoparams: "echoParams",
  explainother: "explainOther",
  logparamslist: "logParamsList",
  omitheader: "omitHeader",
  segmentterminateearly: "segmentTerminateEarly",
  timeallowed: "timeAllowed"
}

export function queryParamsMode(value) {
  try {
    JSON.parse(value || "")
    return "json"
  } catch {
    return "text"
  }
}

export function queryParamsWarning(value) {
  const text = value || ""

  for (const [typo, correction] of Object.entries(SOLR_PARAM_TYPOS)) {
    if (new RegExp(typo).test(text)) {
      return `Your query params contain <code>${typo}</code>, you probably meant <code>${correction}</code>.`
    }
  }

  return ""
}

export function formatJson(value) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return null
  }
}

export function validateNumberOfRows(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 100
}

export function customHeadersForType(type) {
  if (type === "API Key") return '{\n  "Authorization": "ApiKey XXX"\n}'
  if (type === "Custom") return '{\n  "KEY": "VALUE"\n}'
  return ""
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
