// Ported from splainer-search queryTemplateSvc — pure ES module, no Angular dependency.
// Hydrates query templates by replacing #$query##, #$keyword1##, #$qOption.x## placeholders.

const defaultConfig = {
  encodeURI: false,
  defaultKw: '""',
}

function encode(queryPart, config) {
  if (config.encodeURI) {
    return encodeURIComponent(queryPart)
  }
  return queryPart
}

// Traverse nested properties: "a.b.c" → obj["a"]["b"]["c"]
// Supports default values via "key|default" syntax
function getDescendantProp(obj, desc) {
  const arr = desc
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  while (arr.length && obj !== null) {
    let key = arr.shift()
    let defaultValue = null
    const pipeIdx = key.indexOf("|")
    if (pipeIdx !== -1) {
      defaultValue = key.substring(pipeIdx + 1)
      key = key.substring(0, pipeIdx)
    } else if (/keyword\d+/.test(key)) {
      defaultValue = ""
    }
    if (Object.keys(obj).indexOf(key) > -1) {
      obj = obj[key]
    } else {
      obj = defaultValue
    }
  }
  return obj
}

function extractReplacements(s, parameters) {
  const extractionRegex = /#\$([\w.|]+)##/g
  const replacements = []
  let match
  do {
    match = extractionRegex.exec(s)
    if (match !== null) {
      const matchedString = match[0]
      const prop = match[1]
      const replacement = getDescendantProp(parameters, prop)
      if (replacement !== null) {
        replacements.push([matchedString, replacement])
      }
    }
  } while (match !== null)
  return replacements
}

function replaceInString(s, optionValues) {
  const singleTemplateMatchRegex = /^#\$[\w.|]+##$/g
  const replacements = extractReplacements(s, optionValues)
  if (singleTemplateMatchRegex.test(s)) {
    return replacements.length > 0 ? replacements[0][1] : s
  } else {
    let replaced = s
    replacements.forEach((replacement) => {
      replaced = replaced.replaceAll(replacement[0], replacement[1])
    })
    return replaced
  }
}

const isObject = (a) => typeof a === "object" && a !== null
const isString = (a) => typeof a === "string"

function applyTemplating(o, parameters) {
  if (isString(o)) {
    return replaceInString(o, parameters)
  } else if (Array.isArray(o)) {
    return o.map((entry) => applyTemplating(entry, parameters))
  } else if (isObject(o)) {
    const obj = Object.assign({}, o)
    for (const key of Object.keys(obj)) {
      obj[key] = applyTemplating(obj[key], parameters)
    }
    return obj
  } else {
    return o
  }
}

export function hydrate(template, queryText, config) {
  if (!config) {
    config = defaultConfig
  }

  if (queryText === null || queryText === undefined) {
    return template
  }

  const parameters = Object.create(null)
  parameters.query = encode(queryText, config)

  const keywords = queryText.split(/[ ,]+/).map((term) => encode(term.trim(), config))
  parameters.keyword = keywords
  keywords.forEach((keyword, idx) => (parameters[`keyword${idx + 1}`] = keyword))

  if (config.qOption) {
    parameters.qOption = config.qOption
  }

  return applyTemplating(template, parameters)
}
