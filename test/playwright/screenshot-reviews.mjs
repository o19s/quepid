import fs from "node:fs"
import path from "node:path"
import {
  historyLocation,
  readHistory,
  sourceFingerprint,
  storedImageStatus
} from "./screen-history.mjs"
import { linkedScreenshotStatus, readScreenshotTracker } from "./screenshot-tracker.mjs"

import { captureRecipes } from "./capture-registry.mjs"
import { screenshotPaths, screenshotSourceCurrent } from "./screenshot-dependencies.mjs"

export function screenshotReviews(
  root,
  tracker = readScreenshotTracker(root),
  history = readHistory(root),
  screenId
) {
  const linked = linkedScreenshotStatus(root, tracker, history, { screenId, currentOnly: true })
  const statuses = new Map()
  // An ID shared by scenarios must be fresh for every linked dependency set.
  for (const row of linked) {
    if (!statuses.has(row.id) || row.current.status !== "current")
      statuses.set(row.id, row.current.status)
  }
  return {
    branch: history.branch,
    screens: Object.values(history.screens)
      .filter((screen) => screenId === undefined || screen.id === screenId)
      .map((screen) => {
        const now = screen.versions.at(-1)
        let captureStatus = statuses.get(screen.id)
        if (!captureStatus) {
          captureStatus = storedImageStatus(root, now).status
          if (captureStatus === "available") {
            try {
              const paths = screenshotPaths(screen.id, screen.paths, tracker)
              captureStatus = screenshotSourceCurrent(
                root,
                screen,
                paths,
                sourceFingerprint(root, paths)
              )
                ? "current"
                : "stale"
            } catch {
              captureStatus = "stale"
            }
          }
        }
        const approval = screen.approval
        const available = ["current", "stale"].includes(captureStatus)
        const approved =
          available &&
          approval?.source === now?.source &&
          approval?.image === now?.image &&
          approval?.capturedAt === now?.capturedAt
        return {
          id: screen.id,
          canRecapture: Boolean(now),
          captureMethod: Object.hasOwn(captureRecipes, screen.id) ? "scripted" : "claude",
          source: now?.source,
          image: now?.image,
          capturedAt: now?.capturedAt,
          captureStatus,
          status: !available ? "capture_due" : approved ? "approved" : "needs_review",
          approvedAt: approved ? approval.approvedAt : null
        }
      })
  }
}

export function setScreenshotApproval(
  root,
  { branch, id, source, image, capturedAt, approved },
  tracker
) {
  if (typeof approved !== "boolean") throw new Error("Approval must be a boolean")
  const location = historyLocation(root)
  const descriptor = fs.openSync(path.join(location.directory, "record.lock"), "wx")
  try {
    const history = readHistory(root)
    const reviews = screenshotReviews(root, tracker, history, id)
    const current = reviews.screens.find((screen) => screen.id === id)
    if (
      branch !== reviews.branch ||
      !current ||
      current.source !== source ||
      current.image !== image ||
      current.capturedAt !== capturedAt
    ) {
      throw new Error(
        "The displayed capture changed; regenerate the manifest and reload before reviewing"
      )
    }
    if (approved && !["current", "stale"].includes(current.captureStatus))
      throw new Error("The capture image is unavailable; restore it before approving")
    if (approved)
      history.screens[id].approval = {
        source,
        image,
        capturedAt,
        approvedAt: new Date().toISOString()
      }
    else delete history.screens[id].approval
    const temporary = path.join(location.directory, "index.json.tmp")
    fs.writeFileSync(temporary, `${JSON.stringify(history, null, 2)}\n`)
    fs.renameSync(temporary, path.join(location.directory, "index.json"))
    current.status = !["current", "stale"].includes(current.captureStatus)
      ? "capture_due"
      : approved
        ? "approved"
        : "needs_review"
    current.approvedAt = approved ? history.screens[id].approval.approvedAt : null
    return { ...reviews, partial: true }
  } finally {
    fs.closeSync(descriptor)
    fs.unlinkSync(path.join(location.directory, "record.lock"))
  }
}
