import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math'
import { Ray } from "@babylonjs/core/Culling/ray";
import '../../helpers/babylonFileLoader'
import '@babylonjs/core/Meshes/instancedMesh'
import { meshFaceIds } from './meshFaceIds';

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
  }

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
  static async loadDie(options) {
    const { sides, theme = 'purpleRock', scene} = options
		let dieType = 'd' + sides
    // create a key for this die type and theme combo for caching and instance creation
    const comboKey = `${dieType}_${theme}`

    if (!scene.getMeshByName(comboKey)) {
      const die = scene.getMeshByName(dieType).clone(comboKey)
      die.material = scene.getMaterialByName(theme)
      // die.material.freeze()
    }

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