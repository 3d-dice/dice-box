import DiceBox from '../src/index.js'

const Dice = new DiceBox({
  id: 'dice-canvas',
  assetPath: '/assets/dice-box/',
  throwForce: 9,
  scale: 6,
})

await Dice.init()

const notationInput = document.getElementById('notation')
const debugEl = document.getElementById('debug')
const arrowLine = document.getElementById('arrow-line')
const canvas = document.getElementById('dice-canvas')

// Screen → world mapping. With a top-down camera at (0, h, 0) the X axis
// ends up inverted versus screen space (empirically: screen-right == world -X,
// screen-down == world +Z). Normalize to [-1, 1] then flip x.
function screenToWorld(sx, sy) {
  const rect = canvas.getBoundingClientRect()
  const size = Dice.config.size ?? 9.5
  const aspect = rect.width / rect.height
  const u = (sx - rect.left) / rect.width * 2 - 1
  const v = (sy - rect.top) / rect.height * 2 - 1
  const xHalf = size * aspect / 2 - 0.5
  const zHalf = size / 2 - 0.5
  const clamp = (n, lim) => Math.max(-lim, Math.min(lim, n))
  return {
    x: clamp(-u * size * aspect / 2, xHalf),
    z: clamp(v * size / 2, zHalf),
  }
}

let dragging = null

function setDebug(obj) {
  debugEl.textContent = Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(2) : JSON.stringify(v)}`)
    .join('\n')
}

function drawArrow(x1, y1, x2, y2) {
  arrowLine.setAttribute('x1', x1)
  arrowLine.setAttribute('y1', y1)
  arrowLine.setAttribute('x2', x2)
  arrowLine.setAttribute('y2', y2)
}

function clearArrow() {
  drawArrow(0, 0, 0, 0)
}

canvas.addEventListener('pointerdown', (e) => {
  // ignore drags originating on the HUD
  if (e.target.closest('#hud')) return
  canvas.setPointerCapture(e.pointerId)
  dragging = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY }
  drawArrow(e.clientX, e.clientY, e.clientX, e.clientY)
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== dragging.id) return
  dragging.x = e.clientX
  dragging.y = e.clientY
  drawArrow(dragging.startX, dragging.startY, dragging.x, dragging.y)
})

canvas.addEventListener('pointerup', (e) => {
  if (!dragging || e.pointerId !== dragging.id) return
  const { startX, startY } = dragging
  const endX = e.clientX
  const endY = e.clientY
  dragging = null
  clearArrow()

  const dxScreen = endX - startX
  const dyScreen = endY - startY
  const dragPx = Math.hypot(dxScreen, dyScreen)

  const notation = notationInput.value || '1d6'
  const MIN_DRAG = 8 // treat small drags as taps → use default random throw

  if (dragPx < MIN_DRAG) {
    setDebug({ note: 'tap — default random throw', notation })
    Dice.roll(notation)
    return
  }

  // origin = drag start, projected into the world plane
  const origin = screenToWorld(startX, startY)
  // direction: drag delta in screen space → world x/z
  // screen-right == world -X, so flip dx; screen-down == world +Z, leave dy.
  const throwDirection = [-dxScreen, 0, dyScreen]

  // strength scales with drag length, normalized against a reference pixel
  // distance so the mapping is resolution-independent. Clamped in the worker.
  const refPx = Math.min(window.innerWidth, window.innerHeight) * 0.4
  const throwStrength = Math.min(dragPx / refPx, 2.5)

  setDebug({
    notation,
    startPx: [startX, startY],
    endPx: [endX, endY],
    dragPx: dragPx,
    throwOrigin: [origin.x, origin.z],
    throwDirection,
    throwStrength,
  })

  Dice.roll(notation, {
    throwOrigin: [origin.x, undefined, origin.z],
    throwDirection,
    throwStrength,
  })
})

canvas.addEventListener('pointercancel', () => {
  dragging = null
  clearArrow()
})

Dice.onRollComplete = (results) => {
  console.log('results', results)
}
