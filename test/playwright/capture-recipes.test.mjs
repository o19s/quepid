import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { captureAdminHome, captureAdminUsersEmpty } from "./capture-recipes.mjs"
import { decodePng } from "./png-diff.mjs"

// Integration checks against the running app. Each replay owns its browser;
// login is the only write and no application fixture rows are created.
test("Admin Home recipe captures a settled dashboard with recorded viewport provenance", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quepid-capture-recipe-"))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const image = path.join(directory, "home.png")
  const messages = []
  const capture = await captureAdminHome(image, (message) => messages.push(message))
  const png = decodePng(fs.readFileSync(image))
  assert.equal(png.width, 1440)
  assert.equal(png.height, 1000)
  assert.equal(capture.accountRole, "administrator")
  assert.equal(capture.recipe, "admin-home")
  assert.ok(messages.some((message) => message.startsWith("Capturing")))
})

test("User Management recipe submits a no-match search and captures the empty table", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quepid-capture-users-"))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const image = path.join(directory, "empty.png")
  const messages = []
  const capture = await captureAdminUsersEmpty(image, (message) => messages.push(message))
  const png = decodePng(fs.readFileSync(image))
  assert.equal(png.width, 1440)
  assert.equal(png.height, 1000)
  assert.equal(capture.accountRole, "administrator")
  assert.equal(capture.recipe, "admin-users-empty")
  assert.equal(capture.search, "screenshot-no-such-user-20261010")
  assert.ok(messages.some((message) => message.startsWith("Capturing")))
})

test("failed authentication never creates a screenshot and does not disclose credentials", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quepid-capture-login-"))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const image = path.join(directory, "home.png")
  const email = "quepid-capture-missing-account@example.invalid"
  const password = "capture-private-fixture-password"
  await assert.rejects(captureAdminHome(image, () => {}, { ...process.env, QUEPID_E2E_ADMIN_EMAIL: email, QUEPID_E2E_ADMIN_PASSWORD: password }), (error) => {
    assert.equal(error.message.includes(email), false)
    assert.equal(error.message.includes(password), false)
    return true
  })
  assert.equal(fs.existsSync(image), false)
})
