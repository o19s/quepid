import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync, spawn } from "node:child_process"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import crypto from "node:crypto"
import { runInNewContext } from "node:vm"
import { readHistory, recordScreen, sourceFingerprint, historyLocation } from "./screen-history.mjs"
import { linkedScreenshotStatus, scenarioCaptureOptions, readScreenshotTracker } from "./screenshot-tracker.mjs"
import { CaptureJobs } from "./capture-jobs.mjs"
import { captureRecipes } from "./capture-registry.mjs"
import { captureOptions, captureScenarioContext } from "./capture-options.mjs"
import { screenshotReviews, setScreenshotApproval } from "./screenshot-reviews.mjs"
import { decodePng } from "./png-diff.mjs"

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/capture-tooling.png")

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quepid-screen-history-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" })
  git("init", "--initial-branch=example")
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Initial")
  fs.mkdirSync(path.join(root, "app"))
  fs.writeFileSync(path.join(root, "app/view.html"), "First")
  const options = { id: "1.2/login", title: "Login", area: "Accounts", paths: ["app/"], image: fixture }
  const record = (extra = {}) => recordScreen(root, { ...options, source: sourceFingerprint(root, options.paths), ...extra })
  return { root, options, record, git }
}

test("unchanged source preserves images and ignores unrelated code, file times and commits", (t) => {
  const { root, record, git } = setup(t)
  record()
  const original = readHistory(root)
  fs.writeFileSync(path.join(root, "unrelated.txt"), "Other code")
  fs.utimesSync(path.join(root, "app/view.html"), new Date(), new Date())
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Unrelated commit")
  assert.equal(record({ image: "/missing.png" }).updated, false)
  assert.deepEqual(readHistory(root), original)
})

test("relevant source changes retain the preceding image and include added/deleted files", (t) => {
  const { root, record } = setup(t)
  record()
  const first = readHistory(root).screens["1.2/login"].versions[0]
  fs.writeFileSync(path.join(root, "app/view.html"), "Second")
  record()
  let versions = readHistory(root).screens["1.2/login"].versions
  assert.equal(versions.length, 2)
  assert.deepEqual(versions[0], first)
  assert.notEqual(versions[0].source, versions[1].source)
  fs.writeFileSync(path.join(root, "app/new.html"), "New")
  record()
  fs.unlinkSync(path.join(root, "app/new.html"))
  record()
  versions = readHistory(root).screens["1.2/login"].versions
  assert.equal(versions.length, 4)
  assert.equal(versions[1].source, versions[3].source)
})

test("source changes during capture and invalid screenshots cannot advance history", (t) => {
  const { root, options, record } = setup(t)
  record()
  const original = readHistory(root)
  const source = sourceFingerprint(root, options.paths)
  fs.writeFileSync(path.join(root, "app/view.html"), "Changed during capture")
  assert.throws(() => record({ source }), /Source changed/)
  assert.throws(() => record({ image: path.join(root, "app/view.html") }))
  assert.deepEqual(readHistory(root), original)
})

test("staging or committing a deletion does not change the working-tree fingerprint", (t) => {
  const { root, options } = setup(t)
  const deleted = path.join(root, "app/deleted.html")
  fs.writeFileSync(deleted, "Deleted source")
  let listedFiles = "app/view.html\0app/deleted.html\0"
  // Simulate Git's index listings without staging any files in the real checkout.
  const fingerprint = runInNewContext(`(${sourceFingerprint.toString()})`, {
    fs, path, crypto,
    digest: (value) => crypto.createHash("sha256").update(value).digest("hex"),
    git: () => listedFiles
  })
  const original = fingerprint(root, options.paths)
  fs.unlinkSync(deleted)
  const unstaged = fingerprint(root, options.paths)
  assert.notEqual(unstaged, original)
  listedFiles = "app/view.html\0"
  assert.equal(fingerprint(root, options.paths), unstaged)
})

test("branches have independent histories", (t) => {
  const { root, record, git } = setup(t)
  record()
  git("symbolic-ref", "HEAD", "refs/heads/another")
  assert.deepEqual(readHistory(root).screens, {})
  git("symbolic-ref", "HEAD", "refs/heads/example")
  assert.equal(readHistory(root).screens["1.2/login"].versions.length, 1)
})

test("legacy can be attached once without replacing current or previous", (t) => {
  const { root, record } = setup(t)
  record()
  const original = readHistory(root).screens["1.2/login"].versions
  record({ legacyImage: fixture, legacyRef: "HEAD" })
  const screen = readHistory(root).screens["1.2/login"]
  assert.deepEqual(screen.versions, original)
  assert.ok(screen.legacy.image)
  assert.throws(() => record({ legacyImage: fixture, legacyRef: "HEAD" }), /already recorded/)
})

test("legacy absence is explicit and requires a source ref", (t) => {
  const { root, record } = setup(t)
  assert.throws(() => record({ legacyAbsent: true }), /source ref/)
  record({ legacyAbsent: true, legacyRef: "HEAD" })
  assert.equal(readHistory(root).screens["1.2/login"].legacy.absent, true)
})

function tracker(paths = ["app/"]) {
  return { parts: { "01": { file: "01-accounts.md", scenarios: {
    "1.2": { title: "Login", last_run: "2099-01-01", paths, screenshots: { "login-form": "1.2/login" } }
  } } } }
}

test("tracker links resolve filenames and content freshness independently of last_run", (t) => {
  const { root, record } = setup(t)
  let [status] = linkedScreenshotStatus(root, tracker())
  assert.equal(status.current.status, "missing")
  record({ legacyImage: fixture, legacyRef: "HEAD" })
  status = linkedScreenshotStatus(root, tracker())[0]
  assert.equal(status.current.status, "current")
  assert.equal(status.previous.status, "not_recorded")
  assert.equal(status.legacy.status, "available")
  assert.ok(fs.existsSync(path.join(root, status.current.image)))
  fs.writeFileSync(path.join(root, "app/view.html"), "Changed")
  assert.equal(linkedScreenshotStatus(root, tracker())[0].current.status, "stale")
  record()
  assert.equal(linkedScreenshotStatus(root, tracker())[0].previous.status, "available")
  fs.unlinkSync(path.join(root, linkedScreenshotStatus(root, tracker())[0].current.image))
  assert.equal(linkedScreenshotStatus(root, tracker())[0].current.status, "missing")
})

test("scenario mapping uses the linked ID, preserves extra dependencies and rejects unlinked states", (t) => {
  const { root, record } = setup(t)
  fs.writeFileSync(path.join(root, "styles.css"), "style")
  record({ paths: ["app/", "styles.css"], source: sourceFingerprint(root, ["app/", "styles.css"]) })
  const capture = scenarioCaptureOptions(root, "1.2", "login-form", [], tracker())
  assert.equal(capture.id, "1.2/login")
  assert.deepEqual(capture.paths, ["app/", "styles.css"])
  fs.writeFileSync(path.join(root, "styles.css"), "new style")
  assert.equal(linkedScreenshotStatus(root, tracker())[0].current.status, "stale")
  assert.throws(() => scenarioCaptureOptions(root, "1.2", "unknown", [], tracker()), /Add screenshots/)
  assert.throws(() => scenarioCaptureOptions(root, "9.9", "login-form", [], tracker()), /Unknown scenario/)
})

test("new tracker dependencies invalidate captures and missing baselines are distinguished from absence", (t) => {
  const { root, record } = setup(t)
  record({ legacyImage: fixture, legacyRef: "HEAD" })
  fs.writeFileSync(path.join(root, "new-dependency.css"), "new")
  assert.equal(linkedScreenshotStatus(root, tracker(["app/", "new-dependency.css"]))[0].current.status, "stale")
  const [status] = linkedScreenshotStatus(root, tracker())
  fs.unlinkSync(path.join(root, status.legacy.image))
  assert.equal(linkedScreenshotStatus(root, tracker())[0].legacy.status, "missing")
})

test("missing images can be restored without advancing or replacing their recorded version", (t) => {
  const { root, record } = setup(t)
  record()
  const original = readHistory(root)
  fs.unlinkSync(path.join(root, ".playwright-mcp", original.screens["1.2/login"].versions[0].image))
  assert.throws(() => record({ image: null }), /missing/)
  assert.equal(record().updated, false)
  assert.deepEqual(readHistory(root), original)
  assert.equal(linkedScreenshotStatus(root, tracker())[0].current.status, "current")
})

test("tracker reader retains screenshot mappings and parses YAML verification dates", (t) => {
  const { root } = setup(t)
  fs.mkdirSync(path.join(root, "docs/manual-testing"), { recursive: true })
  fs.writeFileSync(path.join(root, "docs/manual-testing/tracking.yml"), 'parts:\n  "01":\n    file: 01-accounts.md\n    scenarios:\n      "1.2":\n        last_run: 2026-10-09T22:00:00Z\n        screenshots:\n          login-form: stable-login\n')
  assert.equal(readScreenshotTracker(root).parts["01"].scenarios["1.2"].screenshots["login-form"], "stable-login")
})

test("corrupt stored images are detected and restored only from original bytes", (t) => {
  const { root, record } = setup(t)
  record({ legacyImage: fixture, legacyRef: "HEAD" })
  const original = readHistory(root)
  const [status] = linkedScreenshotStatus(root, tracker())
  fs.writeFileSync(path.join(root, status.current.image), "corrupt")
  fs.writeFileSync(path.join(root, status.legacy.image), "corrupt")
  const [corrupt] = linkedScreenshotStatus(root, tracker())
  assert.equal(corrupt.current.status, "corrupt")
  assert.equal(corrupt.legacy.status, "corrupt")
  assert.equal(record().updated, false)
  assert.deepEqual(readHistory(root), original)
  assert.equal(linkedScreenshotStatus(root, tracker())[0].current.status, "current")
})

test("explicit capture times survive registration and invalid times are rejected", (t) => {
  const { root, record } = setup(t)
  record({ capturedAt: "2020-01-01T12:00:00Z", legacyCapturedAt: "2019-01-01T12:00:00Z", legacyImage: fixture, legacyRef: "HEAD" })
  const screen = readHistory(root).screens["1.2/login"]
  assert.equal(screen.versions[0].capturedAt, "2020-01-01T12:00:00.000Z")
  assert.equal(screen.legacy.capturedAt, "2019-01-01T12:00:00.000Z")
  assert.throws(() => record({ capturedAt: "invalid" }), /Capture time/)
  assert.throws(() => record({ capturedAt: "2999-01-01" }), /Capture time/)
})

test("PNG decoding rejects missing end chunks and truncated chunks", () => {
  const bytes = fs.readFileSync(fixture)
  assert.throws(() => decodePng(bytes.subarray(0, bytes.length - 12)), /incomplete PNG/)
  assert.throws(() => decodePng(bytes.subarray(0, 30)), /truncated PNG/)
})

test("viewer bounds decoded comparisons and retries failed image loads", async () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshot-viewer.html"), "utf8")
  const source = html.slice(html.indexOf("      function comparePair(item)"), html.indexOf("      async function readPair(item)"))
  const cache = new Map()
  let reads = 0
  const compare = runInNewContext(`${source}; comparePair`, {
    pixelCache: cache,
    readPair: async (item) => {
      reads++
      if (item.before === "broken") throw new Error("missing image")
      return item
    }
  })
  const item = (before) => ({ before, after: "current" })
  await compare(item("one"))
  await compare(item("one"))
  assert.equal(reads, 1)
  for (const key of ["two", "three", "four"]) await compare(item(key))
  assert.equal(cache.size, 3)
  assert.equal(cache.has("one\0current"), false)
  await assert.rejects(compare(item("broken")), /missing image/)
  await assert.rejects(compare(item("broken")), /missing image/)
  assert.equal(reads, 6)
})

test("viewer routes reject repository secrets, traversal and screenshot symlinks", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quepid-viewer-routes-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, ".playwright-mcp"))
  fs.writeFileSync(path.join(root, ".env"), "private fixture")
  fs.copyFileSync(fixture, path.join(root, ".playwright-mcp", "image.png"))
  fs.symlinkSync(path.join(root, ".env"), path.join(root, ".playwright-mcp", "secret.png"))
  const script = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshot-viewer-server.mjs"), "utf8")
  const source = script.slice(script.indexOf("function safePath("), script.indexOf("await runManifestGenerator()"))
  const resolve = runInNewContext(`${source}; safePath`, { fs, path, repoRoot: root })
  assert.equal(resolve("/.playwright-mcp/image.png"), path.join(root, ".playwright-mcp", "image.png"))
  for (const url of ["/.env", "/.git/HEAD", "/.playwright-mcp/../.env", "/.playwright-mcp/secret.png", "/../outside.png"]) {
    assert.equal(resolve(url), null)
  }
  assert.throws(() => resolve("/%ZZ"), /URI malformed/)
})

function approve(root, approved = true, extra = {}) {
  const reviews = screenshotReviews(root, tracker())
  return setScreenshotApproval(root, { branch: reviews.branch, ...reviews.screens[0], approved, ...extra }, tracker())
}

test("approval persists across reads and unchanged recordings, unrelated changes and commits", (t) => {
  const { root, record, git } = setup(t)
  record()
  assert.equal(screenshotReviews(root, tracker()).screens[0].status, "needs_review")
  assert.equal(approve(root).screens[0].status, "approved")
  record()
  fs.writeFileSync(path.join(root, "unrelated.txt"), "Unrelated")
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Unrelated")
  assert.equal(screenshotReviews(root, tracker()).screens[0].status, "approved")
  assert.ok(readHistory(root).screens["1.2/login"].approval.approvedAt)
  assert.equal(approve(root, false).screens[0].status, "needs_review")
})

test("source changes are advisory; approval belongs to the image and new captures need review", (t) => {
  const { root, record } = setup(t)
  record()
  approve(root)
  const prior = readHistory(root).screens["1.2/login"].versions[0]
  fs.writeFileSync(path.join(root, "app/view.html"), "Changed")
  assert.equal(screenshotReviews(root, tracker()).screens[0].status, "approved")
  assert.equal(screenshotReviews(root, tracker()).screens[0].captureStatus, "stale")
  assert.equal(approve(root).screens[0].status, "approved")
  record()
  assert.equal(screenshotReviews(root, tracker()).screens[0].status, "needs_review")
  assert.throws(() => approve(root, true, prior), /displayed capture changed/)
  assert.equal(approve(root).screens[0].status, "approved")
})

test("approvals reject wrong branches and unavailable images; dependency changes are advisory", (t) => {
  const { root, record } = setup(t)
  record()
  approve(root)
  assert.throws(() => approve(root, true, { branch: "other" }), /displayed capture changed/)
  fs.writeFileSync(path.join(root, "dependency.css"), "New dependency")
  assert.equal(screenshotReviews(root, tracker(["app/", "dependency.css"])).screens[0].status, "approved")
  const current = readHistory(root).screens["1.2/login"].versions[0]
  fs.writeFileSync(path.join(root, ".playwright-mcp", current.image), "Corrupt")
  assert.equal(screenshotReviews(root, tracker()).screens[0].status, "capture_due")
  assert.throws(() => approve(root), /image is unavailable/)
  fs.unlinkSync(path.join(root, ".playwright-mcp", current.image))
  assert.throws(() => approve(root), /image is unavailable/)
  assert.throws(() => approve(root, "true"), /boolean/)
})

test("shared screen IDs report all dependency changes without expiring image approvals", (t) => {
  const { root, record } = setup(t)
  record()
  approve(root)
  fs.writeFileSync(path.join(root, "dependency.css"), "New dependency")
  const shared = tracker()
  shared.parts["01"].scenarios["1.3"] = { paths: ["app/", "dependency.css"], screenshots: { form: "1.2/login" } }
  assert.equal(screenshotReviews(root, shared).screens[0].status, "approved")
  const current = readHistory(root).screens["1.2/login"].versions.at(-1)
  assert.equal(setScreenshotApproval(root, { branch: "example", id: "1.2/login", ...current, approved: true }, shared).screens[0].status, "approved")
  assert.equal(screenshotReviews(root, { parts: {} }).screens[0].status, "approved")
})

test("approval checks only the selected screen and returns a partial update", (t) => {
  const { root, record } = setup(t)
  record()
  record({ id: "other", title: "Other" })
  const linked = tracker()
  linked.parts["01"].scenarios["1.3"] = {
    screenshots: { other: "other" },
    get paths() { throw new Error("Unrelated dependencies must not be scanned") }
  }
  const history = readHistory(root)
  const current = history.screens["1.2/login"].versions.at(-1)
  const response = setScreenshotApproval(root, { branch: history.branch, id: "1.2/login", ...current, approved: true }, linked)
  assert.equal(response.partial, true)
  assert.deepEqual(response.screens.map((screen) => screen.id), ["1.2/login"])
  assert.equal(response.screens[0].status, "approved")
  assert.deepEqual(readHistory(root).screens.other, history.screens.other)
})

test("partial review responses preserve other screens; full scans and branch mismatches invalidate them", () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshot-viewer.html"), "utf8")
  const source = html.slice(html.indexOf("      function applyReviews(data)"), html.indexOf("      async function refreshReviews()"))
  const now = { source: "source", image: "image", capturedAt: "time" }
  const items = ["selected", "other"].map((screenId) => ({ screenId, now, review: { status: "needs_review" } }))
  const apply = runInNewContext(`${source}; applyReviews`, { items, manifest: { current: { branch: "example" } } })
  const other = items[1].review
  const response = { branch: "example", partial: true, screens: [{ id: "selected", ...now, status: "approved", captureStatus: "current" }] }
  apply(response)
  assert.equal(items[0].review.status, "approved")
  assert.equal(items[1].review, other)
  apply({ ...response, partial: false })
  assert.equal(items[1].review, null)
  items[1].review = other
  apply({ ...response, branch: "other" })
  assert.equal(items[0].review, null)
  assert.equal(items[1].review, null)
})

test("review writes use the capture recorder lock and leave history unchanged on conflict", (t) => {
  const { root, record } = setup(t)
  record()
  const original = readHistory(root)
  const directory = path.dirname(path.join(root, ".playwright-mcp", original.screens["1.2/login"].versions[0].image))
  fs.writeFileSync(path.join(directory, "record.lock"), "")
  assert.throws(() => approve(root), /EEXIST/)
  assert.deepEqual(readHistory(root), original)
})


test("explicit recapture appends a revision at unchanged source, clears approval and preserves Legacy", (t) => {
  const { root, record } = setup(t)
  record({ legacyImage: fixture, legacyRef: "HEAD" })
  approve(root)
  const before = readHistory(root).screens["1.2/login"]
  record({ recapture: true, expectedBranch: "example", expectedCurrent: before.versions.at(-1), capture: { recipe: "test" } })
  const after = readHistory(root).screens["1.2/login"]
  assert.equal(after.versions.length, 2)
  assert.deepEqual(after.versions[0], before.versions[0])
  assert.deepEqual(after.legacy, before.legacy)
  assert.equal(after.approval, undefined)
  assert.deepEqual(after.versions[1].capture, { recipe: "test" })
  assert.equal(screenshotReviews(root, tracker()).screens[0].status, "needs_review")
  assert.equal(record().updated, false)
})

test("recapture publication rejects changed branches and competing capture revisions", (t) => {
  const { root, record } = setup(t)
  record()
  const current = readHistory(root).screens["1.2/login"].versions.at(-1)
  assert.throws(() => record({ recapture: true, expectedBranch: "other", expectedCurrent: current }), /Branch changed/)
  record({ recapture: true })
  assert.throws(() => record({ recapture: true, expectedBranch: "example", expectedCurrent: current }), /Current capture changed/)
  assert.equal(readHistory(root).screens["1.2/login"].versions.length, 2)
})

test("all recorded screens can use Claude fallback, including unlinked screens, while unknown IDs are rejected", async (t) => {
  const { root, options, record } = setup(t)
  record()
  const shared = { parts: { accounts: { file: "accounts.md", scenarios: {
    first: { title: "Login", paths: ["app/"], notes: "Use normal login", screenshots: { login: options.id } },
    second: { title: "Shared login", paths: ["shared.css"], screenshots: { form: options.id } }
  } } } }
  fs.writeFileSync(path.join(root, "shared.css"), "shared dependency")
  const capture = captureOptions(root, options.id, shared)
  assert.ok(capture.paths.includes("shared.css"))
  assert.ok(capture.paths.includes("test/playwright/capture-agent.md"))
  assert.equal(captureScenarioContext(root, options.id, shared).length, 2)
  assert.equal(captureOptions(root, options.id, { parts: {} }).id, options.id)
  assert.throws(() => captureOptions(root, "unknown", shared), /Unknown recorded screen/)
  const review = screenshotReviews(root, shared).screens[0]
  assert.equal(review.canRecapture, true)
  assert.equal(review.captureMethod, "claude")
  const history = readHistory(root)
  const jobs = new CaptureJobs(root, async () => {}, async (directory, job) => {
    recordScreen(directory, { ...capture, image: options.image, source: job.source, recapture: true, expectedBranch: job.branch, expectedCurrent: job.current, capture: { recipe: "claude-mcp" } })
  }, shared)
  const job = jobs.start({ id: options.id, branch: history.branch, ...history.screens[options.id].versions.at(-1) })
  await jobs.completion
  assert.equal(jobs.get(job.jobId).state, "succeeded")
  assert.equal(readHistory(root).screens[options.id].versions.length, 2)
  assert.equal(screenshotReviews(root, shared).screens[0].captureStatus, "current")
})

test("blocked Claude fallback retains Current and Legacy and releases the job lock", async (t) => {
  const { root, options, record } = setup(t)
  record({ legacyImage: fixture, legacyRef: "HEAD" })
  const history = readHistory(root)
  const jobs = new CaptureJobs(root, async () => {}, async () => { throw new Error("Claude capture blocked: required fixture unavailable") }, { parts: {} })
  const job = jobs.start({ id: options.id, branch: history.branch, ...history.screens[options.id].versions.at(-1) })
  await jobs.completion
  assert.equal(jobs.get(job.jobId).state, "failed")
  assert.match(jobs.get(job.jobId).message, /required fixture unavailable/)
  assert.deepEqual(readHistory(root), history)
  assert.equal(jobs.active(), null)
})

function captureSetup(t) {
  const context = setup(t)
  context.options.id = "14.2/home"
  context.record()
  const captureTracker = { parts: { "14": { file: "14-admin-area.md", scenarios: {
    "14.2": { title: "Admin Home", paths: ["app/"], screenshots: { home: "14.2/home" } }
  } } } }
  const request = () => {
    const history = readHistory(context.root)
    const now = history.screens["14.2/home"].versions.at(-1)
    return { id: "14.2/home", branch: history.branch, ...now }
  }
  const replay = async (root, job, progress) => {
    progress("Capturing…")
    recordScreen(root, {
      ...context.options,
      paths: [...context.options.paths, ...captureRecipes[job.id].paths],
      source: job.source,
      recapture: true,
      expectedBranch: job.branch,
      expectedCurrent: job.current
    })
  }
  return { ...context, captureTracker, request, replay }
}

test("capture jobs publish a fresh image, regenerate comparisons and expose progress", async (t) => {
  const { root, captureTracker, request, replay } = captureSetup(t)
  let regenerated = 0
  const jobs = new CaptureJobs(root, async () => { regenerated++ }, replay, captureTracker)
  const job = jobs.start(request())
  assert.equal(job.state, "running")
  await jobs.completion
  assert.equal(jobs.get(job.jobId).state, "succeeded")
  assert.equal(regenerated, 1)
  assert.equal(readHistory(root).screens["14.2/home"].versions.length, 2)
  assert.equal(fs.existsSync(jobs.lock), false)
})

test("failed replay retains the current capture, releases the lock and supports retry", async (t) => {
  const { root, captureTracker, request, replay } = captureSetup(t)
  const before = readHistory(root)
  const jobs = new CaptureJobs(root, async () => {}, async () => { throw new Error("Login failed") }, captureTracker)
  const job = jobs.start(request())
  await jobs.completion
  assert.equal(jobs.get(job.jobId).state, "failed")
  assert.equal(jobs.get(job.jobId).message, "Login failed")
  assert.deepEqual(readHistory(root), before)
  jobs.replay = replay
  const retry = jobs.start(request())
  await jobs.completion
  assert.equal(jobs.get(retry.jobId).state, "succeeded")
})

test("capture jobs serialize across viewer instances and reject unsupported or old requests", async (t) => {
  const { root, captureTracker, request } = captureSetup(t)
  let release
  const jobs = new CaptureJobs(root, async () => {}, () => new Promise((resolve) => { release = resolve }), captureTracker)
  const other = new CaptureJobs(root, async () => {}, async () => {}, captureTracker)
  assert.throws(() => jobs.start({ ...request(), id: "not-configured" }), /not configured/)
  assert.throws(() => jobs.start({ ...request(), branch: "another" }), /Displayed capture changed/)
  const job = jobs.start(request())
  assert.throws(() => other.start(request()), /Another screenshot capture/)
  assert.equal(other.get(job.jobId).state, "running")
  release()
  await jobs.completion
  assert.throws(() => other.get("../index"), /Invalid capture job/)
})

async function captureOwner(t, root, captureTracker, request) {
  const module = new URL("./capture-jobs.mjs", import.meta.url).href
  const child = spawn(process.execPath, ["--input-type=module", "-e", `
    import { CaptureJobs } from ${JSON.stringify(module)}
    const jobs = new CaptureJobs(${JSON.stringify(root)}, async () => {}, async () => new Promise(() => {}), ${JSON.stringify(captureTracker)})
    const job = jobs.start(${JSON.stringify(request)})
    setInterval(() => {}, 1000)
    process.send(job)
  `], { stdio: ["ignore", "ignore", "inherit", "ipc"] })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit")
      child.kill("SIGKILL")
      await exited
    }
  })
  const [job] = await once(child, "message")
  return { child, job }
}

test("restarted viewers recover a killed owner's job and allow retry without replacing history", async (t) => {
  const { root, captureTracker, request, replay } = captureSetup(t)
  const before = readHistory(root)
  const { child, job } = await captureOwner(t, root, captureTracker, request())
  const restarted = new CaptureJobs(root, async () => {}, replay, captureTracker)
  assert.equal(restarted.active().state, "running")
  assert.throws(() => restarted.start(request()), /Another screenshot capture/)
  const exited = once(child, "exit")
  child.kill("SIGKILL")
  await exited

  const recovered = restarted.get(job.jobId)
  assert.equal(recovered.state, "failed")
  assert.match(recovered.message, /viewer stopped.*Retry capture/)
  assert.equal(restarted.active(), null)
  assert.deepEqual(readHistory(root), before)
  assert.equal(restarted.get(job.jobId).state, "failed")
  const retry = restarted.start(request())
  await restarted.completion
  assert.equal(restarted.get(retry.jobId).state, "succeeded")
})

test("capture start reclaims an abandoned job without requiring a status read", async (t) => {
  const { root, captureTracker, request, replay } = captureSetup(t)
  const { child, job } = await captureOwner(t, root, captureTracker, request())
  const exited = once(child, "exit")
  child.kill("SIGKILL")
  await exited
  const restarted = new CaptureJobs(root, async () => {}, replay, captureTracker)
  const retry = restarted.start(request())
  await restarted.completion
  assert.equal(restarted.get(job.jobId).state, "failed")
  assert.equal(restarted.get(retry.jobId).state, "succeeded")
})

test("recovery releases a dead owner's terminal lock without changing its outcome", async (t) => {
  const { root, captureTracker, request } = captureSetup(t)
  const { child, job } = await captureOwner(t, root, captureTracker, request())
  const restarted = new CaptureJobs(root, async () => {}, async () => {}, captureTracker)
  // Simulate a stop between saving the terminal state and releasing the lock.
  restarted.save({ ...job, state: "succeeded", message: "Captured" })
  const exited = once(child, "exit")
  child.kill("SIGKILL")
  await exited
  assert.equal(restarted.active().state, "succeeded")
  assert.equal(restarted.active(), null)
  assert.equal(restarted.get(job.jobId).message, "Captured")
})

test("source edits during capture fail without replacing Current", async (t) => {
  const { root, captureTracker, request, replay } = captureSetup(t)
  const before = readHistory(root)
  const jobs = new CaptureJobs(root, async () => {}, async (...args) => {
    fs.writeFileSync(path.join(root, "app/view.html"), "Changed while browser was running")
    await replay(...args)
  }, captureTracker)
  const job = jobs.start(request())
  await jobs.completion
  assert.equal(jobs.get(job.jobId).state, "failed")
  assert.match(jobs.get(job.jobId).message, /Source changed/)
  assert.deepEqual(readHistory(root), before)
})


test("viewer displays recorded screenshots while approval status is still loading", async () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshot-viewer.html"), "utf8")
  const source = html.slice(html.indexOf("      async function init(preserveSelection"), html.indexOf('      document.getElementById("search").addEventListener'))
  let finishReviews
  const pendingReviews = new Promise((resolve) => { finishReviews = resolve })
  const elements = new Map()
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "" })
    return elements.get(id)
  }
  let selected
  let navRendered = false
  const init = runInNewContext(`${source}; init`, {
    activeId: null, archiveView: false, historyScreen: null, manifestUrl: "screenshot-manifest.json",
    document: { getElementById: element },
    fetch: async () => ({ ok: true, json: async () => ({ current: { branch: "example", groups: [], singles: [{ id: "screen" }] } }) }),
    refreshReviews: () => pendingReviews,
    renderNav: () => { navRendered = true },
    select: (id) => { selected = id }
  })
  const loading = init()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(navRendered, true)
  assert.equal(selected, "screen")
  finishReviews()
  await loading
})

function differenceBrowserFixture(search = "") {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshot-viewer.html"), "utf8")
  const functions = html.slice(html.indexOf("      function differsFromLegacy"), html.indexOf("      function renderReview"))
  const navigation = html.slice(html.indexOf("      function selectRelative(delta)"), html.indexOf("      async function init"))
  const items = ["A", "B", "C"].map(id => ({ id, title: `Screen ${id}`, topic: "core/workbench", legacyComparison: { byteIdentical: false }, review: { status: "needs_review" } }))
  let finishApproval
  const approval = new Promise(resolve => { finishApproval = resolve })
  const browser = runInNewContext(`${functions}\n${navigation}\nfunction select(id) { activeId = id }\n({ visibleItems, approveAndNext, selectRelative, active: () => activeId })`, {
    items, activeId: "A", archiveView: false, diffMode: true,
    document: { getElementById: id => ({ search: { value: search }, "review-filter": { value: "all" }, "diff-show-approved": { checked: false } })[id] },
    approveCurrent: async () => { await approval; items[0].review.status = "approved" }
  })
  return { browser, items, finishApproval }
}

test("difference navigation includes screens matched only by sidebar topic", () => {
  const { browser } = differenceBrowserFixture("  CORE/WORKBENCH  ")
  assert.equal(browser.visibleItems().length, 3)
  browser.selectRelative(1)
  assert.equal(browser.active(), "B")
})

test("approval completion preserves navigation made while the request was pending", async () => {
  const { browser, items, finishApproval } = differenceBrowserFixture()
  const saving = browser.approveAndNext()
  browser.selectRelative(1)
  assert.equal(browser.active(), "B")
  finishApproval()
  await saving
  assert.equal(items[0].review.status, "approved")
  assert.equal(items[1].review.status, "needs_review")
  assert.equal(browser.active(), "B")
})

test("approval still advances when the approved screen remains selected", async () => {
  const { browser, finishApproval } = differenceBrowserFixture()
  const saving = browser.approveAndNext()
  finishApproval()
  await saving
  assert.equal(browser.active(), "B")
})

test("review controls render safely before selection and disable recapture for unsupported states", () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshot-viewer.html"), "utf8")
  const source = html.slice(html.indexOf("      function renderReview(item)"), html.indexOf("      function applyReviews(data)"))
  const elements = new Map()
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { classList: { toggle() {} }, append(text) { this.textContent += text } })
    return elements.get(id)
  }
  const render = runInNewContext(`${source}; renderReview`, { document: { getElementById: element }, archiveView: false, captureJob: null, captureError: null, reviewLoading: false })
  render(null)
  assert.equal(element("recapture-current").textContent, "Recapture Current")
  assert.equal(element("recapture-current").disabled, true)
  render({ id: "unsupported", review: { captureStatus: "current", status: "needs_review", canRecapture: false } })
  assert.equal(element("recapture-current").disabled, true)
  assert.match(element("review-status").textContent, /Automatic capture not configured/)
})

test("branch changes during replay cannot publish a Current image on another branch", async (t) => {
  const { root, captureTracker, request, replay, git } = captureSetup(t)
  const before = readHistory(root)
  const jobs = new CaptureJobs(root, async () => {}, async (...args) => {
    git("symbolic-ref", "HEAD", "refs/heads/another")
    await replay(...args)
  }, captureTracker)
  const job = jobs.start(request())
  await jobs.completion
  assert.equal(jobs.get(job.jobId).state, "failed")
  assert.match(jobs.get(job.jobId).message, /Branch changed/)
  assert.deepEqual(readHistory(root).screens, {})
  git("symbolic-ref", "HEAD", "refs/heads/example")
  assert.deepEqual(readHistory(root), before)
})

test("surface scoping ignores unloaded CSS/layouts while retaining shared and explicit dependencies", (t) => {
  const { root, record } = setup(t)
  for (const directory of ["app/assets/stylesheets", "app/views/layouts"]) fs.mkdirSync(path.join(root, directory), { recursive: true })
  for (const file of ["app/assets/stylesheets/base.css", "app/assets/stylesheets/core-additions.css", "app/views/layouts/admin.html.erb"]) fs.writeFileSync(path.join(root, file), "original")
  const paths = ["app/", "app/assets/stylesheets/", "app/views/layouts/"]
  // Keep the page dependency specific, rather than swallowing CSS through app/.
  paths[0] = "app/view.html"
  const scoped = tracker(paths)
  scoped.screenshot_surfaces = { parts: { "01": "application" } }
  record({ paths, source: sourceFingerprint(root, paths) })
  const original = readHistory(root)
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "current")
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/core-additions.css"), "core change")
  fs.writeFileSync(path.join(root, "app/views/layouts/admin.html.erb"), "admin change")
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "current")
  const options = scenarioCaptureOptions(root, "1.2", "login-form", [], scoped)
  assert.equal(options.paths.includes("app/assets/stylesheets/core-additions.css"), false)
  assert.equal(recordScreen(root, { ...options, source: sourceFingerprint(root, options.paths) }).updated, false)
  assert.deepEqual(readHistory(root), original)
  scoped.parts["01"].scenarios["1.2"].paths.push("app/assets/stylesheets/core-additions.css")
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "stale")
  scoped.parts["01"].scenarios["1.2"].paths.pop()
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/base.css"), "shared change")
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "stale")
})

test("surface changes include new files in the loaded bundle and do not hide newly tracked dependencies", (t) => {
  const { root, record } = setup(t)
  fs.mkdirSync(path.join(root, "app/assets/stylesheets"), { recursive: true })
  const paths = ["app/view.html", "app/assets/stylesheets/"]
  const scoped = tracker(paths)
  scoped.screenshot_surfaces = { parts: { "01": "application" } }
  record({ paths, source: sourceFingerprint(root, paths) })
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/signup.css"), "new loaded CSS")
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "stale")
  fs.unlinkSync(path.join(root, "app/assets/stylesheets/signup.css"))
  fs.writeFileSync(path.join(root, "new-dependency.css"), "new")
  scoped.parts["01"].scenarios["1.2"].paths.push("new-dependency.css")
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "stale")
})

test("legacy metadata narrowing verifies its original source and cannot bless dirty unknown captures", (t) => {
  const { root, record } = setup(t)
  fs.mkdirSync(path.join(root, "app/assets/stylesheets"), { recursive: true })
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/core-additions.css"), "original")
  const paths = ["app/view.html", "app/assets/stylesheets/"]
  const scoped = tracker(paths)
  scoped.screenshot_surfaces = { parts: { "01": "application" } }
  record({ paths, source: sourceFingerprint(root, paths) })
  const history = readHistory(root)
  const current = history.screens["1.2/login"].versions[0]
  delete current.sourceFiles
  delete current.sourcePaths
  // Old dirty captures have no per-file evidence; unchanged broad content is
  // still provable, but changed broad content cannot be projected safely.
  assert.equal(linkedScreenshotStatus(root, scoped, history)[0].current.status, "current")
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/core-additions.css"), "changed")
  assert.equal(linkedScreenshotStatus(root, scoped, history)[0].current.status, "stale")
})

test("old clean captures can narrow dependencies using a verified commit without rewriting provenance", (t) => {
  const { root, record } = setup(t)
  fs.mkdirSync(path.join(root, "app/assets/stylesheets"), { recursive: true })
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/core-additions.css"), "original")
  const paths = ["app/view.html", "app/assets/stylesheets/"]
  const scoped = tracker(paths)
  scoped.screenshot_surfaces = { parts: { "01": "application" } }
  record({ paths, source: sourceFingerprint(root, paths) })
  // Construct a historical tree without using or changing Git's index.
  const git = (args, input) => execFileSync("git", ["-C", root, ...args], { input, encoding: "utf8" }).trim()
  const blob = text => git(["hash-object", "-w", "--stdin"], text)
  const tree = text => git(["mktree"], text)
  const cssTree = tree(`100644 blob ${blob("original")}\tcore-additions.css\n`)
  const assetsTree = tree(`040000 tree ${cssTree}\tstylesheets\n`)
  const appTree = tree(`100644 blob ${blob("First")}\tview.html\n040000 tree ${assetsTree}\tassets\n`)
  const rootTree = tree(`040000 tree ${appTree}\tapp\n`)
  const commit = git(["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit-tree", rootTree, "-m", "Captured sources"])
  const history = readHistory(root)
  const current = history.screens["1.2/login"].versions[0]
  delete current.sourceFiles
  delete current.sourcePaths
  Object.assign(current, { dirty: false, commit })
  const original = structuredClone(history)
  fs.writeFileSync(path.join(root, "app/assets/stylesheets/core-additions.css"), "irrelevant change")
  assert.equal(linkedScreenshotStatus(root, scoped, history)[0].current.status, "current")
  assert.deepEqual(history, original)
  current.source = "incorrect provenance"
  assert.equal(linkedScreenshotStatus(root, scoped, history)[0].current.status, "stale")
})

test("capture infrastructure edits do not invalidate application images but remain viewer dependencies", (t) => {
  const { root, record } = setup(t)
  fs.mkdirSync(path.join(root, "test/playwright"), { recursive: true })
  const runner = "test/playwright/capture-options.mjs"
  fs.writeFileSync(path.join(root, runner), "original runner")
  const paths = ["app/view.html", runner]
  record({ paths, source: sourceFingerprint(root, paths) })
  const scoped = tracker(paths)
  scoped.screenshot_surfaces = { parts: { "01": "application" } }
  fs.writeFileSync(path.join(root, runner), "new capture workflow")
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "current")
  scoped.screenshot_surfaces.parts["01"] = "viewer"
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "stale")
})


test("attaching Legacy while narrowing metadata preserves an old Current source contract", (t) => {
  const { root, record } = setup(t)
  fs.mkdirSync(path.join(root, "app/assets/stylesheets"), { recursive: true })
  const paths = ["app/view.html", "app/assets/stylesheets/"]
  record({ paths, source: sourceFingerprint(root, paths) })
  const history = readHistory(root)
  const original = history.screens["1.2/login"].versions[0]
  delete original.sourceFiles
  delete original.sourcePaths
  fs.writeFileSync(path.join(historyLocation(root).directory, "index.json"), JSON.stringify(history))
  const scoped = tracker(paths)
  scoped.screenshot_surfaces = { parts: { "01": "application" } }
  const options = scenarioCaptureOptions(root, "1.2", "login-form", [], scoped)
  recordScreen(root, { ...options, source: sourceFingerprint(root, options.paths), legacyImage: fixture, legacyRef: "HEAD" })
  const screen = readHistory(root).screens["1.2/login"]
  assert.deepEqual(screen.versions, [original])
  assert.deepEqual(screen.paths, paths)
  assert.equal(linkedScreenshotStatus(root, scoped)[0].current.status, "current")
})
