import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import '@babylonjs/core/Engines/Extensions/engine.cubeTexture'

const defaultOptions = {
  enableShadows: true
}

function createPointLights(options = defaultOptions) {
  const { enableShadows } = options

  const p_light1 = new PointLight("PointLight1", new Vector3(-10,35,10))
  p_light1.intensity = .6
  
  const p_light2 = new PointLight("PointLight2", new Vector3(11,35,0))
  p_light2.intensity = .7
  
  if(enableShadows){
    p_light1.shadowMinZ = 1
    p_light1.shadowMaxZ = 50
    p_light1.shadowGenerator = new ShadowGenerator(1024, p_light1);
    p_light1.shadowGenerator.useCloseExponentialShadowMap = true;
    p_light1.shadowGenerator.darkness = .6;
    // p_light1.shadowGenerator.usePoissonSampling = true;
    // p_light1.shadowGenerator.bias = 0
    p_light2.shadowMinZ = 1
    p_light2.shadowMaxZ = 50
    p_light2.shadowGenerator = new ShadowGenerator(1024, p_light2);
    p_light2.shadowGenerator.useCloseExponentialShadowMap = true;
    p_light2.shadowGenerator.darkness = .6;
    // p_light2.shadowGenerator.usePoissonSampling = true;
    // p_light2.shadowGenerator.bias = 0
  }

  return {point1:p_light1, point2: p_light2}
}

export { createPointLights }