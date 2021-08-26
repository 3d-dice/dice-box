import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

const defaultOptions = {
  enableShadows: true
}

function createLights(options = defaultOptions) {
  const { enableShadows } = options
  const d_light = new DirectionalLight("DirectionalLight", new Vector3(-0.4, -1, -0.3))
  d_light.position = new Vector3(5,30,5)
  d_light.intensity = .3

  
  const h_light = new HemisphericLight("HemisphericLight", new Vector3(1, 1, 0))
  h_light.intensity = .7
  
  if(enableShadows){
    d_light.shadowMinZ = 1
    d_light.shadowMaxZ = 40
		// d_light.autoCalcShadowZBounds = true
    d_light.shadowGenerator = new ShadowGenerator(1024, d_light);
    d_light.shadowGenerator.useCloseExponentialShadowMap = true; // best
		// d_light.shadowGenerator.usePercentageCloserFiltering = true; // good
		// d_light.shadowGenerator.useContactHardeningShadow = true;
    // d_light.shadowGenerator.usePoissonSampling = true;
    // d_light.shadowGenerator.useBlurExponentialShadowMap = true;
    d_light.shadowGenerator.darkness = .7;
    // d_light.shadowGenerator.bias = 0
		d_light.shadowGenerator.frustumEdgeFalloff = 0
  }

  return {directional: d_light, hemispheric: h_light}
}

export { createLights }