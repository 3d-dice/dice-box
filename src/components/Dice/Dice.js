import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Vector3 } from '@babylonjs/core/Maths/math'
import { Ray } from "@babylonjs/core/Culling/ray";
import '../../helpers/babylonFileLoader'
import '@babylonjs/core/Meshes/instancedMesh'
import { meshFaceIds } from './meshFaceIds';

import { loadTheme } from './themes'

let times = []
const average = (array) => array.reduce((a, b) => a + b) / array.length;
let timer
let averageTimer = ()=>{
  console.log(`average`, average(times))
}

const defaultOptions = {
  assetPath: '',
  enableShadows: false,
  groupId: null,
  id: null,
	lights: [],
  rollId: null,
  scene: null,
  sides: 6,
  theme: 'purpleRock'
}

class Dice {
  mesh = null
  result = 0
  asleep = false
  constructor(options) {
    this.config = {...defaultOptions, ...options}
    this.id = this.config.id !== undefined ? this.config.id : Date.now()
		this.dieType = `d${this.config.sides}`
    this.comboKey = `${this.dieType}_${this.config.theme}`

    this.createInstance()
    
  }

  createInstance() {
    const t1 = performance.now()

    const dieInstance = this.config.scene.getMeshByName(this.comboKey).createInstance(`${this.dieType}-instance-${this.id}`)
    const dieHitbox = this.config.scene.getMeshByName(`${this.dieType}_hitbox`).createInstance(`${this.dieType}-hitbox-${this.id}`)

    dieInstance.addChild(dieHitbox)

		// start the instance under the floor, out of camera view
		dieInstance.position.y = -100
		
    if(this.config.enableShadows){
      for (const key in this.config.lights) {
        if(key !== 'hemispheric' ) {
          this.config.lights[key].shadowGenerator.addShadowCaster(dieInstance)
        }
      }
    }

    // attach the instance to the class object
    this.mesh = dieInstance

    const t2 = performance.now()
    times.push(t2 - t1)
    clearTimeout(timer)
    timer = setTimeout(averageTimer,1000)


    // return die
  }

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
  static async loadDie(options) {
    console.log("start loading die")
    const { sides, theme = 'purpleRock', assetPath, scene} = options
		let dieType = 'd' + sides
    // create a key for this die type and theme combo for caching and instance creation
    const comboKey = `${dieType}_${theme}`

    // load the theme first - each theme should contain the textures for all dice types
    if (!scene.getMaterialByName(theme)) {
      console.log("load theme")
      await loadTheme(theme, assetPath, scene)
      console.log("done loading theme")
    }

    if (!scene.getMeshByName(comboKey)) {
      const die = scene.getMeshByName(dieType).clone(comboKey)
      die.material = scene.getMaterialByName(theme)
      // die.material.freeze()
    }

    console.log("done loading die")

    return options
  }

  // load all the dice models
  static async loadModels(options) {
    const {assetPath, scene} = options
    const models = await SceneLoader.ImportMeshAsync(null,`${assetPath}models/`, "diceMeshes.babylon", scene)

    models.meshes.forEach(model => {

      if(model.id === "__root__") return
        model.setEnabled(false)
        model.freezeNormals()
        // meshes[model.id] = model
    })
  }

  static async getRollResult(die) {
    const getDieRoll = (d=die) => new Promise((resolve,reject) => {

			const vector = d.dieType === 'd4' ? new Vector3(0, -1, 0) : new Vector3(0, 1, 0)
			const picked = d.config.scene.pickWithRay(new Ray(d.mesh.position, vector, 3))

			d.result = meshFaceIds[d.dieType][picked.faceId]

      return resolve(d.result)
    })
    return await getDieRoll()
  }
}

export default Dice