import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera'
import { Engine, Scene } from '@babylonjs/core'

const zoom = [
	[170,.25],
	[145,.25],
	[125,.25],
	[105,.25],
	[90,.25],
	[80,.25],
	[70,.25],
	[60,.25],
]

// this module has dynamically loaded modules so it's been made async
function createCamera( options: { engine?: Engine; zoomLevel: number; scene?: Scene; debug?: unknown } ) {
  const { zoomLevel, scene } = options
  let camera
  const cameraDistance = zoom[zoomLevel][0]

	camera = new TargetCamera("TargetCamera1", new Vector3(0, cameraDistance, 0), scene)
	camera.fov = zoom[zoomLevel][1]
	camera.minZ = 5
	camera.maxZ = cameraDistance + 1
	//@ts-expect-error Property 'wheelPrecision' does not exist on type 'TargetCamera'.
  camera.wheelPrecision = 50
  camera.setTarget(Vector3.Zero())
  return camera
}

export { createCamera }