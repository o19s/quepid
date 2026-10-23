import { describe, expect, it } from "vitest"
import { escapeHtml, renderTextWithLinks, sanitizeHtml, sanitizeSnippetHtml } from "utils/html"

describe("html escaping", () => {
  it("escapes &, <, >, and both quote types", () => {
    expect(escapeHtml(`<a href="x" title='y'>&`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;")
  })

  it("treats null and undefined as empty", () => {
    expect(escapeHtml(null)).toBe("")
    expect(escapeHtml(undefined)).toBe("")
  })

  it("makes attribute-breakout payloads inert", () => {
    const div = document.createElement("div")
    div.innerHTML = `<span data-x="${escapeHtml('"><img src=x onerror=alert(1)>')}"></span>`
    expect(div.querySelector("img")).toBeNull()
    expect(div.firstElementChild.dataset.x).toBe('"><img src=x onerror=alert(1)>')
  })
})

describe("sanitizeHtml", () => {
  const allowedTags = new Set(["A", "B"])

  it("flattens unknown tags to their text under the text policy", () => {
    const policy = { allowedTags, unknownTags: "text" }
    expect(sanitizeHtml("<div>kept <b>bold</b></div><script>alert(1)</script>", policy)).toBe(
      "kept boldalert(1)"
    )
  })

  it("unwraps unknown tags and removes dropped tags under the unwrap policy", () => {
    const policy = { allowedTags, droppedTags: new Set(["SCRIPT"]), unknownTags: "unwrap" }
    expect(sanitizeHtml("<div>kept <b>bold</b></div><script>alert(1)</script>", policy)).toBe(
      "kept <b>bold</b>"
    )
  })

  it("strips attributes and keeps only http(s) links", () => {
    const policy = { allowedTags, unknownTags: "text" }
    expect(sanitizeHtml("<b onclick='x()' class='y'>Hi</b>", policy)).toBe("<b>Hi</b>")
    expect(sanitizeHtml("<a href='javascript:alert(1)'>bad</a>", policy)).toBe("<a>bad</a>")
    expect(sanitizeHtml("<a href='https://example.test/'>ok</a>", policy)).toBe(
      '<a href="https://example.test/" target="_blank" rel="noopener noreferrer">ok</a>'
    )
  })

  it("treats null and undefined as empty", () => {
    expect(sanitizeHtml(null, { allowedTags, unknownTags: "text" })).toBe("")
    expect(sanitizeHtml(undefined, { allowedTags, unknownTags: "text" })).toBe("")
  })
})

describe("sanitizeSnippetHtml", () => {
  it("keeps snippet emphasis and flattens everything else to text", () => {
    expect(sanitizeSnippetHtml("<em>a</em> <mark>b</mark> <div>c</div><script>d</script>")).toBe(
      "<em>a</em> <mark>b</mark> cd"
    )
  })
})

describe("sanitizeSnippetHtml allowlist", () => {
  it.each(["a", "b", "em", "i", "mark", "strong"])("keeps <%s> markup", (tag) => {
    expect(sanitizeSnippetHtml(`<${tag}>x</${tag}>`)).toBe(`<${tag}>x</${tag}>`)
  })

  it("keeps <br> and flattens everything else to text", () => {
    expect(sanitizeSnippetHtml("a<br>b")).toBe("a<br>b")
    expect(sanitizeSnippetHtml("<u>x</u><script>1</script>")).toBe("x1")
    expect(sanitizeSnippetHtml('<b onclick="x()">y</b>')).toBe("<b>y</b>")
  })
})

describe("structured external link icons", () => {
  it.each([
    ["https://engine.test/select", true, 1],
    ["https://engine.test/select", false, 0],
    ["javascript:alert(1)", true, 0],
    ["", true, 0]
  ])("renders opted-in safe icons for %s (%s)", (href, externalIcon, count) => {
    const container = document.createElement("div")
    container.append(renderTextWithLinks([{ text: "Solr <instance>", href, externalIcon }]))
    expect(container.textContent).toBe("Solr <instance>")
    expect(container.querySelectorAll("i.bi-box-arrow-up-right")).toHaveLength(count)
    expect(container.querySelector("instance")).toBeNull()
    if (count) expect(container.querySelector("i").getAttribute("aria-hidden")).toBe("true")
  })
})
