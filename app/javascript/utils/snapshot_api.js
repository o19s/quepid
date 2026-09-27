import { apiFetch } from "api/fetch"

export async function fetchSnapshot(url, fetcher = apiFetch) {
  const response = await fetcher(`${url}?shallow=true`)
  if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`)
  return response.json()
}

export async function deleteSnapshot(url, snapshotId, fetcher = apiFetch) {
  const response = await fetcher(`${url}/${encodeURIComponent(snapshotId)}`, { method: "DELETE" })
  if (!response.ok) throw new Error(`Snapshot delete failed (${response.status})`)
  return response
}
