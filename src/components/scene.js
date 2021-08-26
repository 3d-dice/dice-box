import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Scene } from '@babylonjs/core/scene'
import { SceneOptimizer, SceneOptimizerOptions } from '@babylonjs/core/Misc/sceneOptimizer'

// const defaultOptions = {
//   debug: false
// }

// this module will dynamically import the scene inspector if debug is set to true
async function createScene(options) {
  const { engine } = options
  const scene = new Scene(engine)

  scene.useRightHandedSystem = true
  scene.clearColor = new Color4(0,0,0,0);
  // if(debug) {
  //   console.log("initializing scene inspector")
  //   // await import('@babylonjs/loaders/glTF')
  //   await import("@babylonjs/inspector")
  //   // await import("@babylonjs/core/Debug/debugLayer")
  //   scene.debugLayer.show({
  //     embedMode: true,
  //   })
  // }

  const optimizationSettings = SceneOptimizerOptions.LowDegradationAllowed()
  optimizationSettings.optimizations = optimizationSettings.optimizations.splice(1)
  optimizationSettings.targetFrameRate = 60

  SceneOptimizer.OptimizeAsync(scene,optimizationSettings)

  return scene
}

export { createScene }