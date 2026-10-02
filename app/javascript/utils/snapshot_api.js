import { apiFetch } from "api/fetch"
import { requestJson } from "api/json"

export function fetchSnapshot(url, fetcher = apiFetch) {
  return requestJson(`${url}?shallow=true`, {}, fetcher)
}

export function deleteSnapshot(url, snapshotId, fetcher = apiFetch) {
  return requestJson(`${url}/${encodeURIComponent(snapshotId)}`, { method: "DELETE" }, fetcher)
}
