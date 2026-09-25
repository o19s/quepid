export function parseCustomHeaders(value) {
  if (!value || (typeof value === "string" && !value.trim())) return { valid: true, headers: null }
  if (typeof value === "object") {
    return { valid: !Array.isArray(value), headers: value }
  }

  try {
    const headers = JSON.parse(value)
    return {
      valid: headers !== null && !Array.isArray(headers) && typeof headers === "object",
      headers
    }
  } catch {
    return { valid: false, headers: null }
  }
}

export function invalidProxyApiMethod(proxyRequests, apiMethod) {
  return proxyRequests === true && apiMethod === "JSONP"
}

export function validateStaticHeaders(headerRow, separator = ",") {
  const headers = String(headerRow || "").split(separator)
  const required = ["Query Text", "Doc ID", "Doc Position"]
  const errors = []

  if (!required.every((header) => headers.includes(header))) {
    errors.push(
      `Required headers mismatch! Please make sure you have the correct headers in your file (check for correct spelling and capitalization): ${required.join(",")}`
    )
  }

  const documentHeaders = headers.filter((header) => !required.includes(header))
  if (documentHeaders.some((header) => header.trim().includes(" "))) {
    errors.push(`Document field names may not contain whitespace: ${documentHeaders.join(",")}`)
  }

  return { valid: errors.length === 0, errors, headers }
}

export function buildFieldSpec(idField, titleField, additionalFields = []) {
  return [
    `id:${idField}`,
    `title:${titleField}`,
    additionalFields
      .map((field) => field.text ?? field)
      .filter(Boolean)
      .join(", ")
  ]
    .filter(Boolean)
    .join(", ")
}

export function addUniqueQuery(queries, queryText) {
  if (queryText === null || queryText === undefined || queryText === "") return queries
  if (queries.some((query) => query.queryString === queryText)) return queries
  return [...queries, { queryString: queryText }]
}

export function formatWizardSaveError(response) {
  const data = response?.data
  let detail = ""

  if (typeof data === "string") {
    detail = data
  } else if (data && typeof data === "object") {
    if (data.error) {
      detail = data.error
    } else {
      detail = Object.entries(data)
        .map(([key, value]) => {
          if (Array.isArray(value)) return `${key} ${value.join(", ")}`
          return typeof value === "string" ? value : ""
        })
        .filter(Boolean)
        .join(". ")
    }
  }

  if (detail)
    return `Could not save your case settings: ${detail}. Please click Finish to try again.`
  return "Could not save your case settings. Please click Finish to try again."
}
