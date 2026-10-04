import { deleteJson, getJson } from "api/json"

export function fetchSnapshot(url) {
  return getJson(`${url}?shallow=true`)
}

export function deleteSnapshot(url, snapshotId) {
  return deleteJson(`${url}/${encodeURIComponent(snapshotId)}`)
}
