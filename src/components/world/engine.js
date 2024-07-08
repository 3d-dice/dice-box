import { Engine } from '@babylonjs/core/Engines/engine'

function createEngine(canvas) {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  })

  return engine
}

export { createEngine }