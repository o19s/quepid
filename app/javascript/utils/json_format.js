/** Pretty-print JSON text with two-space indentation; parsing errors propagate. */
export function prettyPrintJson(value) {
  return JSON.stringify(JSON.parse(value), null, 2)
}
