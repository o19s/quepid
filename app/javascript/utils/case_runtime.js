import { CORE_EVENTS } from "utils/core_events"
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
  let generation = 0
  let revision = 0
  const pendingReads = new Map()
  const mutations = new Map()

  // Fresh reads may overlap across modal opens. Only the latest request in the
  // current selection can refresh the selected record; saves invalidate reads
  // that began before the mutation.
  function read(caseNo, { url = `api/cases/${caseNo}` } = {}) {
    const pending = pendingReads.get(url)
    if (pending?.generation === generation && pending.revision === revision) return pending.promise
    const requestGeneration = generation
    const requestRevision = ++revision
    const promise = getJson(url)
      .then((data) => {
        if (
          generation === requestGeneration &&
          revision === requestRevision &&
          isSameId(selectedCase?.caseNo, caseNo)
        ) {
          Object.assign(selectedCase, parseCase({ ...data, case_id: caseNo }))
          publishBookSettings(selectedCase)
        }
        return data
      })
      .finally(() => {
        if (pendingReads.get(url)?.promise === promise) pendingReads.delete(url)
      })
    pendingReads.set(url, { generation: requestGeneration, revision: requestRevision, promise })
    return promise
  }

  function publishBookSettings(value) {
    document.dispatchEvent(
      new CustomEvent(CORE_EVENTS.CASE_BOOK_UPDATED, {
        detail: {
          caseId: Number(value.caseNo),
          bookId: value.bookId ?? null,
          bookName: value.bookName ?? null,
          autoPopulateBookPairs: value.autoPopulateBookPairs === true,
          autoPopulateCaseJudgements: value.autoPopulateCaseJudgements === true
        }
      })
    )
  }

  return {
    read,
    initialize(data) {
      return this.select(parseCase(data))
    },
    async load(caseNo) {
      return parseCase(await read(caseNo))
    },
    async saveBookSettings(caseNo, payload, { url = `api/cases/${caseNo}` } = {}) {
      const requestGeneration = generation
      revision += 1
      const mutation = Symbol()
      mutations.set(String(caseNo), mutation)
      const data = await putJson(url, payload)
      if (generation !== requestGeneration || mutations.get(String(caseNo)) !== mutation)
        return data
      revision += 1
      const detail = {
        caseId: Number(caseNo),
        bookId: payload.book_id,
        bookName: data?.book_name || null,
        autoPopulateBookPairs: payload.auto_populate_book_pairs,
        autoPopulateCaseJudgements: payload.auto_populate_case_judgements
      }
      if (isSameId(selectedCase?.caseNo, caseNo)) {
        Object.assign(selectedCase, {
          bookId: detail.bookId,
          bookName: detail.bookName,
          autoPopulateBookPairs: detail.autoPopulateBookPairs,
          autoPopulateCaseJudgements: detail.autoPopulateCaseJudgements
        })
      }
      publishBookSettings({ caseNo, ...detail })
      return data
    },
    selected: () => selectedCase,
    select: (value) => {
      generation += 1
      selectedCase = value
      if (value) {
        document.dispatchEvent(
          new CustomEvent(CORE_EVENTS.CASE_SELECTED, {
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
      if (isSameId(selectedCase?.caseNo, value.caseNo)) {
        generation += 1
        selectedCase = null
      }
    },
    async rename(value, name) {
      if (!name || name.length === 0) return
      await putJson(`api/cases/${value.caseNo}`, { case_name: name })
      value.caseName = name
      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.CASE_RENAMED, {
          detail: { caseNo: value.caseNo, caseName: name }
        })
      )
    },
    async updateNightly(value) {
      const { caseNo, nightly } = value
      const requestGeneration = generation
      const mutationKey = `nightly:${caseNo}`
      const mutation = Symbol()
      mutations.set(mutationKey, mutation)
      revision += 1
      await putJson(`api/cases/${caseNo}`, { nightly })
      if (generation !== requestGeneration || mutations.get(mutationKey) !== mutation) return
      // A read started during the PUT can also contain the old server value.
      revision += 1
      if (isSameId(selectedCase?.caseNo, caseNo)) selectedCase.nightly = nightly
      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.CASE_HEADER_STALE, {
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
      generation += 1
      pendingReads.clear()
      selectedCase = null
    }
  }
}

// One selected-case owner for the page; factory instances remain isolated in tests.
export const caseRuntime = createCaseRuntime()
