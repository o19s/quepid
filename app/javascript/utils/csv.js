/**
 * RFC 4180-style CSV parser shared by the rating and snapshot importers.
 *
 * Handles quoted fields (commas, newlines, and `""` escapes inside quotes) and
 * CRLF/LF/CR line endings, so it round-trips what `utils/case_csv` exports.
 * It also reads files from Quepid 8.6.0 and earlier, whose exporter escaped
 * quotes as `""` without wrapping fields that had no comma or newline (e.g.
 * `""star wars""`); a quote is only treated as opening a quoted field at the
 * start of one. Values are trimmed. Rows whose column count differs from the
 * header are still returned, but each one is reported in `errors` with its line
 * number so callers can refuse the file instead of silently dropping data.
 *
 * @param {string} content
 * @returns {{ headers: string[], rows: Record<string, string>[], errors: string[] }}
 */
export function parseCsv(content) {
  const parsedRows = []
  const errors = []
  let row = []
  let value = ""
  let quoted = false
  let line = 1
  let rowStartLine = 1

  const pushRow = () => {
    // Ignore blank lines before checking column counts; delimiter-only rows
    // still carry columns and must retain their validation behavior.
    if (row.some(Boolean) || row.length > 1) parsedRows.push({ values: row, line: rowStartLine })
    row = []
    value = ""
    rowStartLine = line + 1
  }

  // Whether the current field has any content yet (leading whitespace aside);
  // a quote only opens a quoted field at the start of one.
  let fieldStarted = false
  const endsField = (char) => char === undefined || char === "," || char === "\n" || char === "\r"
  // The first character at or after `from` that isn't a space or tab.
  const nextNonBlank = (from) => {
    let at = from
    while (content[at] === " " || content[at] === "\t") at += 1
    return content[at]
  }

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]
    if (char === '"') {
      if (quoted) {
        if (next === '"') {
          value += '"'
          index += 1
        } else quoted = false
      } else if (
        !fieldStarted &&
        next === '"' &&
        content[index + 2] !== '"' &&
        !endsField(nextNonBlank(index + 2))
      ) {
        // Exports from Quepid 8.6.0 and earlier escaped quotes as "" without
        // wrapping the field unless it also held a comma or newline, so the
        // phrase query "star wars" was written as ""star wars"".
        value += '"'
        index += 1
      } else if (!fieldStarted) {
        quoted = true
      } else {
        // A quote inside an unquoted field is literal; "" is the legacy escape.
        value += '"'
        if (next === '"') index += 1
      }
      fieldStarted = true
    } else if (char === "," && !quoted) {
      row.push(value.trim())
      value = ""
      fieldStarted = false
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(value.trim())
      pushRow()
      line += 1
      fieldStarted = false
    } else {
      if (char.trim()) fieldStarted = true
      // A line break inside a quoted value still advances the file's line
      // number, so later error messages point at the right line.
      if (char === "\n" || (char === "\r" && content[index + 1] !== "\n")) line += 1
      value += char
    }
  }
  if (quoted) {
    errors.push(`line ${rowStartLine}: unclosed quote.`)
    row.push(value.trim())
    pushRow()
  } else if (value || row.length) {
    row.push(value.trim())
    pushRow()
  }

  const headerRow = parsedRows.shift()
  const headers = headerRow?.values || []
  const rows = parsedRows.map(({ values, line: rowLine }) => {
    if (values.length !== headers.length) {
      errors.push(`line ${rowLine}: expected ${headers.length} columns but found ${values.length}.`)
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
  })
  return { headers, rows, errors }
}
