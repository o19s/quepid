import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import crypto from "node:crypto"
import { runInNewContext } from "node:vm"
import { readHistory, recordScreen, sourceFingerprint } from "./screen-history.mjs"
import { linkedScreenshotStatus, scenarioCaptureOptions, readScreenshotTracker } from "./screenshot-tracker.mjs"

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "baselines/core_smoke.spec.ts/snapshot-modal.png")

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
