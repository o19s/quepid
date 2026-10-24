import test from "node:test"
import assert from "node:assert/strict"
import { COMPARE_OPTIONS, diffRegions, thumbnail, thumbnailDifference } from "./png-diff.mjs"

function solid(width, height, [r, g, b]) {
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i)
  return { width, height, data }
}

function paint(image, x0, y0, w, h, [r, g, b]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) image.data.set([r, g, b, 255], (y * image.width + x) * 4)
  }
}

test("identical images report no changed pixels or regions", () => {
  const diff = diffRegions(solid(64, 64, [255, 255, 255]), solid(64, 64, [255, 255, 255]))
  assert.equal(diff.pixelIdentical, true)
  assert.deepEqual(diff.regions, [])
})

test("a block that changes color becomes one padded region", () => {
  const before = solid(100, 100, [255, 255, 255])
  const after = solid(100, 100, [255, 255, 255])
  paint(after, 20, 30, 16, 12, [0, 0, 0])
  const diff = diffRegions(before, after)
  assert.equal(diff.pixelIdentical, false)
  assert.equal(diff.regions.length, 1)
  const [box] = diff.regions
  assert.ok(box.x <= 20 && box.y <= 30 && box.x + box.width >= 36 && box.y + box.height >= 42)
})

test("a subtle shade change in a large fill is still detected", () => {
  // The kind of change the default pixelmatch threshold (0.1) misses.
  const before = solid(80, 80, [217, 83, 79])
  const after = solid(80, 80, [201, 48, 44])
  assert.ok(COMPARE_OPTIONS.threshold < 0.1)
  assert.equal(diffRegions(before, after).pixelIdentical, false)
})

test("a size mismatch is reported instead of compared", () => {
  const diff = diffRegions(solid(10, 10, [0, 0, 0]), solid(10, 12, [0, 0, 0]))
  assert.equal(diff.dimensionMismatch, true)
})

test("a small change keeps thumbnails near-identical but a different page does not", () => {
  const page = solid(480, 300, [255, 255, 255])
  paint(page, 0, 0, 480, 40, [40, 40, 40]) // header bar
  const withModal = solid(480, 300, [255, 255, 255])
  paint(withModal, 0, 0, 480, 40, [40, 40, 40])
  paint(withModal, 200, 120, 40, 20, [0, 120, 200]) // small dialog button
  const other = solid(480, 300, [255, 255, 255])
  paint(other, 0, 100, 480, 150, [20, 20, 20])
  assert.ok(thumbnailDifference(thumbnail(page), thumbnail(withModal)) <= 2)
  assert.ok(thumbnailDifference(thumbnail(page), thumbnail(other)) > 20)
})
