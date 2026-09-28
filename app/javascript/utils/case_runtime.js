import { apiFetch } from "api/fetch"

const parseCase = (data) => ({
  caseNo: data.case_id,
  lastTry: data.last_try_number,
  caseName: data.case_name,
  lastScore: data.last_score,
  scorerId: data.scorer_id,
  owned: data.owned,
  ownerName: data.owner_name,
  ownerId: data.owner_id,
  bookId: data.book_id,
  bookName: data.book_name,
  autoPopulateBookPairs: data.auto_populate_book_pairs,
  autoPopulateCaseJudgements: data.auto_populate_case_judgements,
  queriesCount: data.queries_count,
  public: data.public,
  archived: data.archived,
  nightly: data.nightly,
  teams: data.teams || [],
  tries: data.tries || [],
  scores: data.scores || [],
  queries: data.queries || []
})

const responseData = async (response, message) => {
  if (!response.ok) throw new Error(`${message} (${response.status})`)
  return response.status === 204 ? null : response.json()
}

const formatDate = (date) => {
  const pad = (value) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" }

export function createCaseRuntime({ request = apiFetch, now = () => new Date() } = {}) {
  let selectedCase = null

  return {
    async load(caseNo) {
      const response = await request(`api/cases/${caseNo}`)
      return parseCase(await responseData(response, "Unable to load case"))
    },
    selected: () => selectedCase,
    select: (value) => {
      selectedCase = value
      if (value && window.quepidSearch) {
        window.quepidSearch.caseState = {
          caseNo: value.caseNo,
          caseName: value.caseName || "",
          bookId: value.bookId || null,
          bookName: value.bookName || null
        }
      }
      return selectedCase
    },
    async delete(value) {
      const response = await request(`api/cases/${value.caseNo}`, {
        method: "DELETE",
        headers: jsonHeaders
      })
      await responseData(response, "Unable to delete case")
      if (selectedCase?.caseNo === value.caseNo) selectedCase = null
    },
    async rename(value, name) {
      if (!name || name.length === 0) return
      const response = await request(`api/cases/${value.caseNo}`, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ case_name: name })
      })
      await responseData(response, "Unable to rename case")
      value.caseName = name
      document.dispatchEvent(
        new CustomEvent("quepid:case-renamed", {
          detail: { caseNo: value.caseNo, caseName: name }
        })
      )
    },
    async updateNightly(value) {
      const response = await request(`api/cases/${value.caseNo}`, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ nightly: value.nightly })
      })
      await responseData(response, "Unable to update nightly evaluation")
      document.dispatchEvent(
        new CustomEvent("quepid:case-header-stale", {
          detail: { caseNo: value.caseNo, reason: "nightly" }
        })
      )
    },
    runEvaluation: (caseNo, tryNo) => {
      const params = tryNo ? `?try_number=${encodeURIComponent(tryNo)}` : ""
      return request(`api/cases/${caseNo}/run_evaluation${params}`, {
        method: "POST",
        headers: jsonHeaders
      })
    },
    trackLastViewedAt: (caseNo) =>
      request(`api/cases/${caseNo}/metadata`, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ metadata: { last_viewed_at: formatDate(now()) } })
      }),
    reset: () => {
      selectedCase = null
    }
  }
}
