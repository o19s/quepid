import fc from "fast-check"
import { expect, it } from "vitest"
import { fillUrlTemplate } from "utils/url_template"

const placeholderName = fc.stringMatching(/^[A-Z][A-Z0-9]{0,5}(_[A-Z0-9]{1,5}){0,2}$/)

const filled = fc.uniqueArray(placeholderName, { minLength: 1, maxLength: 5 }).chain((names) =>
  fc.record({
    names: fc.constant(names),
    values: fc.tuple(...names.map(() => fc.string({ minLength: 1 })))
  })
)

it("puts each value, decoded, back where its placeholder was", () => {
  fc.assert(
    fc.property(filled, ({ names, values }) => {
      const template = `/x/${names.map((name) => `__${name}__`).join("/")}`
      const url = fillUrlTemplate(
        template,
        Object.fromEntries(names.map((name, index) => [name, values[index]]))
      )

      expect(url.split("/").slice(2).map(decodeURIComponent)).toEqual(values)
    })
  )
})
