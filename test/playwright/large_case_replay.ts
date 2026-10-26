import type { Page, Route } from "@playwright/test"

/**
 * Deterministic stand-in for a Solr core, so large-case benchmarks never touch a real engine.
 *
 * The response shape copies a real `statedecoded` response captured from quepid-solr.dev.o19s.com
 * (the engine behind `thor sample_data:large_data`): 10 docs with `id`, `catch_line`,
 * `structure` and a 0.9–3.4 KB `text`; `debug=true` with structured BM25 explains 5 levels deep
 * (12 nodes per matched term plus the `sum of:` root); and `echoParams=all`. That response was
 * ~47 KB of compact JSON, as is this generator's, so memory and parse cost match what users see.
 *
 * Every doc's text is distinct per query, as with a real index, and the output depends only on the
 * query text, so A/B runs see identical responses. Served over JSONP, the default Solr transport.
 */
export const REPLAY_SOLR_URL = "http://bench-solr.invalid/solr/statedecoded/select"

const WORDS = (
  "the shall section any person state board commission county court may such " +
  "provided authority public property law notice payment tax license order department provision " +
  "requirement agency district contract service member article chapter subsection pursuant within " +
  "application regulation employee school vehicle owner land water health record hearing fund"
).split(" ")

function seededRandom(seedText: string): () => number {
  let seed = 2166136261
  for (const ch of seedText) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619)
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507)
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909)
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296
  }
}

function words(random: () => number, minChars: number, maxChars: number): string {
  const target = minChars + Math.floor(random() * (maxChars - minChars))
  const out: string[] = []
  let length = 0
  while (length < target) {
    const word = WORDS[Math.floor(random() * WORDS.length)]
    out.push(word)
    length += word.length + 1
  }
  return out.join(" ")
}

function node(value: number, description: string, details?: unknown[]) {
  return details
    ? { match: true, value, description, details }
    : { match: true, value, description }
}

function termExplain(random: () => number, term: string, docNumber: number) {
  const idf = 1 + random() * 4
  const tf = 0.3 + random() * 0.6
  const boost = 2.2
  const score = boost * idf * tf
  return node(score, `weight(text:${term} in ${docNumber}) [SchemaSimilarity], result of:`, [
    node(score, "score(freq=3.0), computed as boost * idf * tf from:", [
      node(boost, "boost"),
      node(idf, "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:", [
        node(Math.floor(random() * 5000), "n, number of documents containing term"),
        node(39893, "N, total number of documents with field")
      ]),
      node(tf, "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:", [
        node(3, "freq, occurrences of term within document"),
        node(1.2, "k1, term saturation parameter"),
        node(0.75, "b, length normalization parameter"),
        node(Math.floor(200 + random() * 600), "dl, length of field (approximate)"),
        node(311.5, "avgdl, average length of field")
      ])
    ])
  ])
}

/** A Solr `select` response for one query, shaped like the captured `statedecoded` response. */
export function solrResponse(queryText: string, rows = 10): Record<string, unknown> {
  const random = seededRandom(queryText)
  const terms = queryText.split(/\s+/).filter(Boolean)
  const docs = []
  const explain: Record<string, unknown> = {}

  for (let i = 0; i < rows; i++) {
    const id = `${terms.join("-")}-${i}`.replace(/[^a-z0-9-]/gi, "")
    docs.push({
      id,
      catch_line: words(random, 30, 90),
      text: `<section prefix='A'>${words(random, 1000, 3800)}</section>`,
      structure: words(random, 30, 70)
    })
    // Half the docs match only the first term, as in the captured response (13 vs 25 nodes).
    const matched = terms.slice(0, random() < 0.5 ? 1 : 2)
    const children = matched.map((term) => termExplain(random, term, i * 17))
    explain[id] = node(
      children.reduce((sum, c) => sum + (c as { value: number }).value, 0),
      "sum of:",
      children
    )
  }

  const parsed = terms.map((term) => `text:${term}`).join(" ")
  return {
    responseHeader: {
      status: 0,
      QTime: 3,
      params: {
        q: queryText,
        echoParams: "all",
        fl: "id catch_line structure text",
        wt: "json",
        debug: "true",
        "debug.explain.structured": "true",
        hl: "false",
        rows: String(rows),
        df: "text"
      }
    },
    response: { numFound: 100 + Math.floor(random() * 5000), start: 0, numFoundExact: true, docs },
    debug: {
      rawquerystring: queryText,
      querystring: queryText,
      parsedquery: parsed,
      parsedquery_toString: parsed,
      explain,
      QParser: "LuceneQParser",
      timing: {
        time: 3,
        prepare: { time: 0, query: { time: 0 } },
        process: { time: 3, query: { time: 2 }, debug: { time: 1 } }
      }
    }
  }
}

/** Serve REPLAY_SOLR_URL from the generator, honouring the JSONP callback splainer-search sends. */
export async function routeReplaySolr(page: Page, { latencyMs = 0 } = {}): Promise<void> {
  await page.route(`${REPLAY_SOLR_URL}**`, async (route: Route) => {
    const url = new URL(route.request().url())
    const body = JSON.stringify(
      solrResponse(url.searchParams.get("q") ?? "", Number(url.searchParams.get("rows") ?? 10))
    )
    if (latencyMs) await new Promise((resolve) => setTimeout(resolve, latencyMs))
    const callback = url.searchParams.get("json.wrf")
    await route.fulfill(
      callback
        ? { status: 200, contentType: "text/javascript", body: `${callback}(${body})` }
        : {
            status: 200,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body
          }
    )
  })
}

/** Distinct two-word query texts, like the large_data sample cases. */
export function replayQueryTexts(count: number): string[] {
  const random = seededRandom("queries")
  const texts = new Set<string>()
  while (texts.size < count) {
    texts.add(
      `${WORDS[Math.floor(random() * WORDS.length)]} ${WORDS[Math.floor(random() * WORDS.length)]} ${texts.size}`
    )
  }
  return [...texts]
}
