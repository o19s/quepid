/**
 * Minimal PNG decoding and before/after region detection for
 * generate-screenshot-manifest.mjs. Playwright screenshots are 8-bit,
 * non-interlaced RGB/RGBA, which is all the decoder needs to support; other
 * PNG variants throw and the manifest records the pair as undiffable.
 */

import zlib from "node:zlib"

// Matches the viewer's per-channel tint threshold (screenshot-viewer.html).
export const PIXEL_THRESHOLD = 8
// Changed pixels are bucketed into CELL×CELL cells; dirty cells within GAP px
// of each other become one region, so a reworded label is one box, not one
// per glyph.
const CELL = 8
const GAP = 24
// Padding keeps the changed pixels visible inside the box outline.
const PAD = 6

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }

export function decodePng(buffer) {
  const signature = "89504e470d0a1a0a"
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("not a PNG")

  let width, height, bitDepth, colorType, interlace
  let ended = false
  const idat = []
  for (let offset = 8; offset < buffer.length; ) {
    if (offset + 12 > buffer.length) throw new Error("truncated PNG chunk")
    const length = buffer.readUInt32BE(offset)
    if (offset + length + 12 > buffer.length) throw new Error("truncated PNG chunk")
    const type = buffer.toString("latin1", offset + 4, offset + 8)
    const body = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      if (length !== 13 || width !== undefined) throw new Error("invalid PNG header")
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      bitDepth = body[8]
      colorType = body[9]
      interlace = body[12]
    } else if (type === "IDAT") {
      idat.push(body)
    } else if (type === "IEND") {
      ended = true
      break
    }
    offset += length + 12
  }
  if (!ended || !width || !height || !idat.length) throw new Error("incomplete PNG")

  const channels = CHANNELS[colorType]
  if (bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${bitDepth}, color type ${colorType}, interlace ${interlace})`)
  }

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  if (raw.length !== (stride + 1) * height) throw new Error("invalid PNG pixel data length")
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    if (filter > 4) throw new Error("invalid PNG filter")
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[dst + x - channels] : 0
      const up = y > 0 ? pixels[dst - stride + x] : 0
      const upLeft = y > 0 && x >= channels ? pixels[dst - stride + x - channels] : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = (left + up) >> 1
      else if (filter === 4) predictor = paeth(left, up, upLeft)
      pixels[dst + x] = (raw[src + x] + predictor) & 0xff
    }
  }

  return { width, height, data: toRgba(pixels, width * height, colorType) }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function toRgba(pixels, count, colorType) {
  if (colorType === 6) return pixels
  const rgba = Buffer.alloc(count * 4)
  for (let i = 0; i < count; i++) {
    const o = i * 4
    if (colorType === 2) {
      rgba[o] = pixels[i * 3]
      rgba[o + 1] = pixels[i * 3 + 1]
      rgba[o + 2] = pixels[i * 3 + 2]
      rgba[o + 3] = 255
    } else {
      const grayAlpha = colorType === 4
      const gray = pixels[grayAlpha ? i * 2 : i]
      rgba[o] = rgba[o + 1] = rgba[o + 2] = gray
      rgba[o + 3] = grayAlpha ? pixels[i * 2 + 1] : 255
    }
  }
  return rgba
}

/**
 * Compares two decoded images and returns the changed-pixel count plus
 * padded bounding boxes ({ x, y, width, height, changedPixels }) around each
 * cluster of changes, largest first.
 */
export function diffRegions(before, after) {
  if (before.width !== after.width || before.height !== after.height) {
    return {
      dimensionMismatch: true,
      beforeWidth: before.width,
      beforeHeight: before.height,
      afterWidth: after.width,
      afterHeight: after.height,
      regions: []
    }
  }

  const { width, height } = before
  const a = before.data
  const b = after.data
  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  const count = new Uint32Array(cols * rows)
  const minX = new Int32Array(cols * rows)
  const minY = new Int32Array(cols * rows)
  const maxX = new Int32Array(cols * rows)
  const maxY = new Int32Array(cols * rows)
  let changedPixels = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (
        Math.abs(a[i] - b[i]) <= PIXEL_THRESHOLD &&
        Math.abs(a[i + 1] - b[i + 1]) <= PIXEL_THRESHOLD &&
        Math.abs(a[i + 2] - b[i + 2]) <= PIXEL_THRESHOLD &&
        Math.abs(a[i + 3] - b[i + 3]) <= PIXEL_THRESHOLD
      ) continue

      changedPixels++
      const cell = Math.floor(y / CELL) * cols + Math.floor(x / CELL)
      if (count[cell]++ === 0) {
        minX[cell] = maxX[cell] = x
        minY[cell] = maxY[cell] = y
      } else {
        if (x < minX[cell]) minX[cell] = x
        if (x > maxX[cell]) maxX[cell] = x
        if (y > maxY[cell]) maxY[cell] = y
      }
    }
  }

  // Flood-fill dirty cells, treating cells within GAP px as neighbours.
  const reach = Math.ceil(GAP / CELL)
  const seen = new Uint8Array(cols * rows)
  let regions = []
  for (let start = 0; start < count.length; start++) {
    if (!count[start] || seen[start]) continue
    seen[start] = 1
    const stack = [start]
    const box = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, changedPixels: 0 }
    while (stack.length) {
      const cell = stack.pop()
      box.x0 = Math.min(box.x0, minX[cell])
      box.y0 = Math.min(box.y0, minY[cell])
      box.x1 = Math.max(box.x1, maxX[cell])
      box.y1 = Math.max(box.y1, maxY[cell])
      box.changedPixels += count[cell]
      const cx = cell % cols
      const cy = Math.floor(cell / cols)
      for (let ny = Math.max(0, cy - reach); ny <= Math.min(rows - 1, cy + reach); ny++) {
        for (let nx = Math.max(0, cx - reach); nx <= Math.min(cols - 1, cx + reach); nx++) {
          const next = ny * cols + nx
          if (count[next] && !seen[next]) {
            seen[next] = 1
            stack.push(next)
          }
        }
      }
    }
    regions.push(box)
  }

  regions = mergeOverlapping(
    regions.map((r) => ({
      x0: Math.max(0, r.x0 - PAD),
      y0: Math.max(0, r.y0 - PAD),
      x1: Math.min(width - 1, r.x1 + PAD),
      y1: Math.min(height - 1, r.y1 + PAD),
      changedPixels: r.changedPixels
    }))
  )

  return {
    width,
    height,
    changedPixels,
    changedPercent: Number(((changedPixels / (width * height)) * 100).toFixed(2)),
    pixelIdentical: changedPixels === 0,
    regions: regions
      .map((r) => ({
        x: r.x0,
        y: r.y0,
        width: r.x1 - r.x0 + 1,
        height: r.y1 - r.y0 + 1,
        changedPixels: r.changedPixels
      }))
      .sort((p, q) => q.width * q.height - p.width * p.height)
  }
}

// Padding can make neighbouring boxes overlap; overlapping boxes would draw
// as a confusing tangle, so fold them together until none overlap.
function mergeOverlapping(boxes) {
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const p = boxes[i]
        const q = boxes[j]
        if (p.x0 <= q.x1 && q.x0 <= p.x1 && p.y0 <= q.y1 && q.y0 <= p.y1) {
          boxes[i] = {
            x0: Math.min(p.x0, q.x0),
            y0: Math.min(p.y0, q.y0),
            x1: Math.max(p.x1, q.x1),
            y1: Math.max(p.y1, q.y1),
            changedPixels: p.changedPixels + q.changedPixels
          }
          boxes.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  return boxes
}
