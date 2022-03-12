import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math'
import { Ray } from "@babylonjs/core/Culling/ray";
// import { RayHelper } from '@babylonjs/core/Debug';
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

		// start the instance under the floor, out of camera view
		dieInstance.position.y = -100
    dieInstance.scaling = new Vector3(this.config.scale,this.config.scale,this.config.scale)
		
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
    const {assetPath, scene, scale} = options
    const models = await SceneLoader.ImportMeshAsync(null,`${assetPath}models/`, "dice-revised.json", scene)

    models.meshes.forEach(model => {
      if(model.id === "__root__") {
        model.dispose()
      }
      if( model.id.includes("collider")) {
        model.scaling = new Vector3(.7,.7,.7)
      }
      model.setEnabled(false)
      model.freezeNormals()
      model.isPickable = false;
      model.doNotSyncBoundingInfo = true;
    })
  }

  updateConfig(option) {
    this.config = {...this.config, ...option}
  }

  static ray = new Ray(Vector3.Zero(), Vector3.Zero(), 1)
  static vector3 = new Vector3.Zero()

  static setVector3(x,y,z) {
    return Dice.vector3.set(x,y,z)
  }
  
  static getVector3() {
    return Dice.vector3
  }

  static async getRollResult(die) {
    const getDieRoll = (d=die) => new Promise((resolve,reject) => {

      const dieHitbox = d.config.scene.getMeshByName(`${d.dieType}_collider`).createInstance(`${d.dieType}-hitbox-${d.id}`)
      dieHitbox.isPickable = true
      dieHitbox.isVisible = true
      dieHitbox.setEnabled(true)
      dieHitbox.position = d.mesh.position
      dieHitbox.rotationQuaternion = d.mesh.rotationQuaternion

			const vector = d.dieType === 'd4' ? Dice.setVector3(0, -1, 0) : Dice.setVector3(0, 1, 0)

      Dice.ray.direction = vector
      Dice.ray.origin = d.mesh.position

      const picked = d.config.scene.pickWithRay(Dice.ray)

      dieHitbox.dispose()

      // let rayHelper = new RayHelper(Dice.ray)
      // rayHelper.show(d.config.scene)
			d.value = meshFaceIds[d.dieType][picked.faceId]

      return resolve(d.value)
    })
    return await getDieRoll()
  }
}

export default Dice