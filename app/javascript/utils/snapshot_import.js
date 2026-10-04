import { postJson } from "api/json"

export function buildSnapshotImportGroups(rows, targetCaseId, { includeFields = true } = {}) {
  const cases = Object.create(null)

  rows.forEach((doc) => {
    const caseId = targetCaseId ?? doc["Case ID"]
    cases[caseId] ||= { snapshots: Object.create(null) }

    const snapshotName = doc["Snapshot Name"]
    cases[caseId].snapshots[snapshotName] ||= {
      queries: Object.create(null),
      created_at: doc["Snapshot Time"],
      name: snapshotName
    }

    const snapshot = cases[caseId].snapshots[snapshotName]
    const queryText = doc["Query Text"]
    snapshot.queries[queryText] ||= { docs: [] }
    const document = {
      id: doc["Doc ID"],
      position: doc["Doc Position"]
    }
    if (includeFields) {
      document.fields = Object.fromEntries(
        Object.entries(doc).filter(
          ([key]) =>
            ![
              "Doc ID",
              "Doc Position",
              "Snapshot Name",
              "Snapshot Time",
              "Case ID",
              "Query Text"
            ].includes(key)
        )
      )
    }
    snapshot.queries[queryText].docs.push(document)
  })

  return cases
}

export async function importSnapshotsToCase(rows, targetCaseId, rootUrl) {
  const groups = buildSnapshotImportGroups(rows, targetCaseId)
  const imported = []

  for (const [caseId, caseData] of Object.entries(groups)) {
    for (const snapshot of Object.values(caseData.snapshots)) {
      const payload = await postJson(`${rootUrl}/api/cases/${caseId}/snapshots/imports`, {
        snapshots: [snapshot]
      })
      imported.push(...(payload.snapshots || []))
    }
  }

  return imported
}
