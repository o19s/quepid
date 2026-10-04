import { postJson } from "api/json"

export function buildSnapshotImportGroups(rows, targetCaseId) {
  const cases = {}

  rows
    .map((row) => ({ ...row, "Case ID": targetCaseId }))
    .forEach((doc) => {
      const caseId = doc["Case ID"]
      cases[caseId] ||= { snapshots: {} }

      const snapshotName = doc["Snapshot Name"]
      cases[caseId].snapshots[snapshotName] ||= {
        queries: {},
        created_at: doc["Snapshot Time"],
        name: snapshotName
      }

      const snapshot = cases[caseId].snapshots[snapshotName]
      const queryText = doc["Query Text"]
      snapshot.queries[queryText] ||= { docs: [] }
      snapshot.queries[queryText].docs.push({
        id: doc["Doc ID"],
        position: doc["Doc Position"],
        fields: Object.fromEntries(
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
      })
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
