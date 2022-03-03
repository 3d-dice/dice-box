import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera'

// this module has dynamically loaded modules so it's been made async
function createCamera(options) {
  const { scene } = options
  let camera
  const cameraDistance = 36.5

	camera = new TargetCamera("TargetCamera1", new Vector3(0, cameraDistance, 0), scene)
	camera.fov = .25
	camera.minZ = 5
	camera.maxZ = cameraDistance + 1
  camera.setTarget(Vector3.Zero())
  return camera
}

export { createCamera }