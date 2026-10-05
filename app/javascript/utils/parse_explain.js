// Invalid serialized explanations must still surface as parse failures.
export function parseExplain(explain) {
  return typeof explain === "string" ? JSON.parse(explain) : explain
}
