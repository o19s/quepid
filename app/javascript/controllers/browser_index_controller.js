import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { patchJson, postJson } from "api/json"
import { serviceFetch } from "api/service_fetch"
import { confirmDialog } from "utils/confirm_dialog"
import { serverMessage } from "utils/error_message"

/**
 * Creates the index and loads the documents from the browser, for a search endpoint that only the browser can reach
 * (not proxied by Quepid, maybe on localhost): the same way the case's own searches reach it. Quepid keeps the case,
 * the new search endpoint and the progress; this sends the definition and the documents to the service, once Quepid
 * has checked the definition as it would its own (validationUrl).
 * Without a probe (the endpoint is proxied) the form is submitted to Quepid as usual, and Quepid does it all.
 */
export default class extends Controller {
  static targets = ["progress", "message", "bar"]
  static values = {
    probe: Object,
    streamUrl: String,
    validationUrl: String,
    progressUrl: String,
    endpointId: Number,
    confirm: String,
    batchSize: { type: Number, default: 500 }
  }

  /**
   * Where the browser has to reach the service itself (a probe), has Quepid check the definition, creates the index,
   * has Quepid set the case up and loads the documents; otherwise leaves the form to Quepid.
   */
  async submit(event) {
    if (!this.hasProbeValue || !this.probeValue.origin) return
    event.preventDefault()
    if (this.confirmValue && !(await confirmDialog(this.confirmValue, "primary"))) return

    // What the user agreed to: read once, so that the index created, every batch and what Quepid records all name the same index.
    const form = Object.fromEntries(new FormData(this.element))
    form.index_name = form.index_name.trim()
    this.running = true
    this.left = false
    this.lock(true)
    this.say("Creating the index…", "text-muted")
    try {
      await postJson(this.validationUrlValue, form)
      await this.createIndex(form)
      const { redirect, load, total } = await postJson(this.element.action, {
        ...form,
        applied: true
      })
      if (load) await this.load(total, { name: form.index_name, path: this.servicePath(form) })
      this.running = false
      if (this.left) return
      window.Turbo ? window.Turbo.visit(redirect) : (window.location = redirect)
    } catch (error) {
      const message = serverMessage(error, "Quepid could not set the case up.")
      this.say(message, "text-danger")
      this.lock(false)
      if (this.loading) await this.report("failed", this.sent, message)
      this.running = false
    }
  }

  /**
   * Leaving the page through Turbo replaces it without a pagehide, and the loading would go on unseen, then take the user
   * back to Dataset Cases when it ended: it stops at the next batch instead, and says so (submit's catch).
   */
  disconnect() {
    if (this.running) this.left = true
  }

  /**
   * Closing the page stops the loading: say so, so that the table does not claim it is still going.
   */
  interrupted() {
    if (!this.running || !this.loading) return
    const data = new FormData()
    data.set("_method", "patch")
    data.set("authenticity_token", this.token)
    data.set("search_endpoint_id", this.endpointIdValue)
    data.set("status", "failed")
    data.set("documents_indexed", this.sent || 0)
    data.set("error", "The browser page was closed before the loading finished.")
    navigator.sendBeacon(this.progressUrlValue, data)
  }

  /**
   * Sends the definition to the service: Solr's schema, a Qdrant collection and its payload indexes, or an
   * Elasticsearch or OpenSearch index.
   * @param {{index_name: string, definition: string, new_endpoint?: string}} form what the user agreed to
   */
  async createIndex(form) {
    const { index_name: name, definition: body } = form
    const { origin, engine, headers } = this.probeValue
    const path = this.servicePath(form)
    const json = { ...headers, "Content-Type": "application/json", Accept: "application/json" }
    const send = async (method, url, payload) => {
      let response
      try {
        response = await serviceFetch(origin + url, {
          method,
          headers: json,
          body: payload,
          credentials: "omit"
        })
      } catch {
        throw new Error(
          `Your browser could not reach ${origin}: is it running, and does it allow requests from this page (CORS)?`
        )
      }
      if ("solr" === engine && 404 === response.status)
        throw new Error(
          `There is no collection ${name} on ${origin}: Solr cannot make one from Quepid, so create it first.`
        )
      if (!response.ok) {
        const text = (await response.text()).replace(/\s+/g, " ").slice(0, 300)
        throw new Error(
          `${origin} answered ${response.status}${409 === response.status || /already_exists/.test(text) ? `: ${name} is already there` : ""}: ${text}`
        )
      }
      return response
    }
    if ("solr" === engine) {
      // Solr can answer 200 and still list what it refused (a field that is already there), as Quepid's Applier knows.
      const text = await (
        await send("POST", path.replace(/\/(select|query)$/, "/schema"), body)
      ).text()
      let answer
      try {
        answer = JSON.parse(text)
      } catch {
        answer = {}
      }
      if (answer.error || answer.errors?.length)
        throw new Error(`${origin} refused the schema: ${text.replace(/\s+/g, " ").slice(0, 300)}`)
    } else if ("qdrant" === engine) {
      const { collection, payload_indexes: indexes } = JSON.parse(body)
      await send("PUT", `/collections/${encodeURIComponent(name)}`, JSON.stringify(collection))
      for (const index of indexes || [])
        await send("PUT", `/collections/${encodeURIComponent(name)}/index`, JSON.stringify(index))
    } else {
      await send("PUT", `/${encodeURIComponent(name)}`, body)
    }
  }

  /**
   * Reads the documents from Quepid, a line each, and sends them to the service in batches. target is the index's name
   * and the endpoint address that searches it (servicePath).
   */
  async load(total, target) {
    this.loading = true
    this.stopIfLeft()
    this.sent = 0
    this.failed = 0
    this.firstError = null
    this.total = total
    this.progress()
    const response = await apiFetch(this.streamUrlValue, {
      headers: { Accept: "application/x-ndjson" }
    })
    if (!response.ok || !response.body)
      throw new Error("Quepid could not give the documents to load.")

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let pending = ""
    let batch = []
    for (;;) {
      const { done, value } = await reader.read()
      pending += value || ""
      const lines = pending.split("\n")
      pending = done ? "" : lines.pop()
      for (const line of done ? lines.concat(pending) : lines) {
        if (!line.trim()) continue
        const doc = JSON.parse(line)
        if (doc.error) throw new Error(doc.error)
        batch.push(doc)
        if (batch.length >= this.batchSizeValue) {
          await this.sendBatch(batch, target)
          batch = []
        }
      }
      if (done) break
    }
    if (batch.length) await this.sendBatch(batch, target)
    await this.refresh(target.name)
    if (this.failed > 0) {
      const message = `${this.failed} of ${this.sent + this.failed} documents were refused, the first because: ${this.firstError}`
      await this.report("failed", this.sent, message)
      throw new Error(message)
    }
    await this.report("done", this.sent)
    this.loading = false
  }

  /**
   * Sends one batch of documents, to Solr's update handler or to the bulk API, and counts what was taken and refused.
   */
  async sendBatch(batch, { name, path }) {
    this.stopIfLeft()
    const { origin, engine, headers } = this.probeValue
    let response
    try {
      if ("solr" === engine) {
        const url = `${origin}${path.replace(/\/(select|query)$/, "/update")}?commit=true`
        response = await serviceFetch(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(batch),
          credentials: "omit"
        })
      } else {
        const lines = batch.flatMap((doc) => [
          JSON.stringify({ index: { _index: name, _id: doc.id } }),
          JSON.stringify(doc)
        ])
        response = await serviceFetch(`${origin}/_bulk`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/x-ndjson" },
          body: `${lines.join("\n")}\n`,
          credentials: "omit"
        })
      }
    } catch {
      throw new Error(`Your browser lost ${origin} while loading.`)
    }
    if (!response.ok)
      throw new Error(
        `${origin} answered ${response.status}: ${(await response.text()).replace(/\s+/g, " ").slice(0, 300)}`
      )

    if ("solr" === engine) {
      this.sent += batch.length
    } else {
      const items = (await response.json()).items || []
      const refused = items.filter(
        (item) => Object.values(item)[0].status < 200 || Object.values(item)[0].status > 299
      )
      this.sent += batch.length - refused.length
      this.failed += refused.length
      if (refused.length && !this.firstError) {
        const error = Object.values(refused[0])[0].error
        this.firstError =
          error && "object" === typeof error
            ? [error.type, error.reason].filter(Boolean).join(": ")
            : String(error)
      }
    }
    this.progress()
    await this.report("indexing", this.sent)
  }

  /**
   * Makes the documents searchable at once (Elasticsearch, OpenSearch); Solr commits with each batch.
   */
  async refresh(name) {
    const { origin, engine, headers } = this.probeValue
    if ("solr" === engine) return
    try {
      await serviceFetch(`${origin}/${encodeURIComponent(name)}/_refresh`, {
        method: "POST",
        headers,
        credentials: "omit"
      })
    } catch {
      // The documents are there; they just show up a second later.
    }
  }

  /**
   * The endpoint's address, pointed at the new collection when one is chosen, as Quepid's copy of the endpoint will be
   * (DatasetIndex::Solr.url_with_index): /solr/shop/select with "wands" is /solr/wands/select. Only Solr's writes go
   * through the address; the other engines name the index in the request.
   */
  servicePath({ index_name: name, new_endpoint: copied }) {
    const { engine, path } = this.probeValue
    if ("solr" !== engine || "true" !== copied) return path
    const collection = path.match(/\/([^/]+)\/(?:select|query)$/)?.[1]
    const named = collection && "solr" !== collection
    return path.replace(
      named ? /\/[^/]+\/(select|query)$/ : /\/(select|query)$/,
      `/${encodeURIComponent(name)}/$1`
    )
  }

  /**
   * Throws once the user has left the page, so that the loading stops there.
   */
  stopIfLeft() {
    if (this.left) throw new Error("The browser page was left before the loading finished.")
  }

  /**
   * Tells Quepid how far the loading has got.
   */
  async report(status, indexed, error = "") {
    try {
      await patchJson(this.progressUrlValue, {
        search_endpoint_id: this.endpointIdValue,
        status,
        documents_indexed: indexed || 0,
        error
      })
    } catch {
      // Quepid not answering must not stop the loading; the next report will say where it is.
    }
  }

  /**
   * Shows how far the loading has got.
   */
  progress() {
    const percent = this.total ? Math.min(100, Math.round((this.sent / this.total) * 100)) : 0
    if (this.hasBarTarget) this.barTarget.style.width = `${percent}%`
    this.say(
      `Indexing documents from your browser: ${this.sent.toLocaleString()} of ${this.total.toLocaleString()}. Keep this page open.`,
      "text-muted"
    )
  }

  /**
   * Shows a message under the button, in a text style.
   */
  say(message, style) {
    if (this.hasProgressTarget) this.progressTarget.hidden = false
    if (!this.hasMessageTarget) return
    this.messageTarget.textContent = message
    this.messageTarget.className = style
  }

  /**
   * Nothing in the form can change while the index is made and loaded; unlocking gives back only what locking took.
   */
  lock(locked) {
    if (locked) {
      this.locked = [...this.element.elements].filter((control) => !control.disabled)
      for (const control of this.locked) control.disabled = true
    } else {
      for (const control of this.locked || []) control.disabled = false
      this.locked = null
    }
  }

  /**
   * The page's CSRF token, for the beacon.
   */
  get token() {
    return document.querySelector("meta[name=csrf-token]")?.content
  }
}
