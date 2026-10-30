import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { patchJson, postJson } from "api/json"
import { serviceFetch } from "api/service_fetch"
import { confirmDialog } from "utils/confirm_dialog"
import { serverMessage } from "utils/error_message"

// Creates the index and loads the documents from the browser, for a search endpoint that only the browser can reach
// (not proxied by Quepid, maybe on localhost): the same way the case's own searches reach it. Quepid keeps the case,
// the new search endpoint and the progress; this sends the definition and the documents to the service.
// Without a probe (the endpoint is proxied) the form is submitted to Quepid as usual, and Quepid does it all.
export default class extends Controller {
  static targets = ["progress", "message", "bar", "submit"]
  static values = {
    probe: Object,
    streamUrl: String,
    progressUrl: String,
    endpointId: Number,
    confirm: String,
    batchSize: { type: Number, default: 500 }
  }

  async submit(event) {
    if (!this.hasProbeValue || !this.probeValue.origin) return
    event.preventDefault()
    if (this.confirmValue && !(await confirmDialog(this.confirmValue, "primary"))) return

    this.running = true
    this.lock(true)
    this.say("Creating the index…", "text-muted")
    try {
      await this.createIndex()
      const form = Object.fromEntries(new FormData(this.element))
      const { redirect, load, total } = await postJson(this.element.action, {
        ...form,
        applied: true
      })
      if (load) await this.load(total)
      this.running = false
      window.Turbo ? window.Turbo.visit(redirect) : (window.location = redirect)
    } catch (error) {
      const message = serverMessage(error, "Quepid could not set the case up.")
      this.say(message, "text-danger")
      this.lock(false)
      if (this.loading) await this.report("failed", this.sent, message)
      this.running = false
    }
  }

  // Closing the page stops the loading: say so, so that the table does not claim it is still going.
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

  async createIndex() {
    const { origin, engine, path, headers } = this.probeValue
    const name = this.field("index_name").value.trim()
    const body = this.field("definition").value
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
      if (!response.ok) {
        const text = (await response.text()).replace(/\s+/g, " ").slice(0, 300)
        throw new Error(
          `${origin} answered ${response.status}${409 === response.status || /already_exists/.test(text) ? `: ${name} is already there` : ""}: ${text}`
        )
      }
    }
    if ("solr" === engine) {
      await send("POST", path.replace(/\/(select|query)$/, "/schema"), body)
    } else if ("qdrant" === engine) {
      const { collection, payload_indexes: indexes } = JSON.parse(body)
      await send("PUT", `/collections/${encodeURIComponent(name)}`, JSON.stringify(collection))
      for (const index of indexes || [])
        await send("PUT", `/collections/${encodeURIComponent(name)}/index`, JSON.stringify(index))
    } else {
      await send("PUT", `/${encodeURIComponent(name)}`, body)
    }
  }

  // Reads the documents from Quepid, a line each, and sends them to the service in batches.
  async load(total) {
    this.loading = true
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
          await this.sendBatch(batch)
          batch = []
        }
      }
      if (done) break
    }
    if (batch.length) await this.sendBatch(batch)
    await this.refresh()
    if (this.failed > 0) {
      const message = `${this.failed} of ${this.sent + this.failed} documents were refused, the first because: ${this.firstError}`
      await this.report("failed", this.sent, message)
      throw new Error(message)
    }
    await this.report("done", this.sent)
    this.loading = false
  }

  async sendBatch(batch) {
    const { origin, engine, path, headers } = this.probeValue
    const name = this.field("index_name").value.trim()
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

  async refresh() {
    const { origin, engine, headers } = this.probeValue
    if ("solr" === engine) return
    try {
      await serviceFetch(
        `${origin}/${encodeURIComponent(this.field("index_name").value.trim())}/_refresh`,
        { method: "POST", headers, credentials: "omit" }
      )
    } catch {
      // The documents are there; they just show up a second later.
    }
  }

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

  progress() {
    const percent = this.total ? Math.min(100, Math.round((this.sent / this.total) * 100)) : 0
    if (this.hasBarTarget) this.barTarget.style.width = `${percent}%`
    this.say(
      `Indexing documents from your browser: ${this.sent.toLocaleString()} of ${this.total.toLocaleString()}. Keep this page open.`,
      "text-muted"
    )
  }

  say(message, style) {
    if (this.hasProgressTarget) this.progressTarget.hidden = false
    if (!this.hasMessageTarget) return
    this.messageTarget.textContent = message
    this.messageTarget.className = style
  }

  lock(locked) {
    if (this.hasSubmitTarget) this.submitTarget.disabled = locked
  }

  field(name) {
    return this.element.querySelector(`[name=${name}]`)
  }

  get token() {
    return document.querySelector("meta[name=csrf-token]")?.content
  }
}
