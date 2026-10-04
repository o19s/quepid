import { deleteJson, getJson, postJson, putJson } from "api/json"
import { isSameId } from "utils/record_identity"

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

const formatDate = (date) => {
  const pad = (value) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function createCaseRuntime({ now = () => new Date() } = {}) {
  let selectedCase = null

  return {
    async load(caseNo) {
      const data = await getJson(`api/cases/${caseNo}`)
      return parseCase(data)
    },
    selected: () => selectedCase,
    select: (value) => {
      selectedCase = value
      if (value) {
        document.dispatchEvent(
          new CustomEvent("quepid:case-selected", {
            detail: {
              caseNo: value.caseNo,
              caseName: value.caseName || "",
              bookId: value.bookId || null,
              bookName: value.bookName || null
            }
          })
        )
      }
      return selectedCase
    },
    async delete(value) {
      await deleteJson(`api/cases/${value.caseNo}`)
      if (isSameId(selectedCase?.caseNo, value.caseNo)) selectedCase = null
    },
    async rename(value, name) {
      if (!name || name.length === 0) return
      await putJson(`api/cases/${value.caseNo}`, { case_name: name })
      value.caseName = name
      document.dispatchEvent(
        new CustomEvent("quepid:case-renamed", {
          detail: { caseNo: value.caseNo, caseName: name }
        })
      )
    },
    async updateNightly(value) {
      await putJson(`api/cases/${value.caseNo}`, { nightly: value.nightly })
      document.dispatchEvent(
        new CustomEvent("quepid:case-header-stale", {
          detail: { caseNo: value.caseNo, reason: "nightly" }
        })
      )
    },
    runEvaluation: (caseNo, tryNo) => {
      const params = tryNo ? `?try_number=${encodeURIComponent(tryNo)}` : ""
      return postJson(`api/cases/${caseNo}/run_evaluation${params}`)
    },
    trackLastViewedAt: (caseNo) =>
      putJson(`api/cases/${caseNo}/metadata`, { metadata: { last_viewed_at: formatDate(now()) } }),
    reset: () => {
      selectedCase = null
    }
  }
}
