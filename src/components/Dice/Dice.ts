import '@babylonjs/core/Meshes/instancedMesh'
import { Mesh } from '@babylonjs/core';
import { Ray } from "@babylonjs/core/Culling/ray";
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math'

import '../../helpers/babylonFileLoader'
import { meshFaceIds } from './meshFaceIds'
import defaultOptions from './defaultOptions'

import { 
  DiceConfigType, 
  DiceConstructorType, 
  DiceModelOptionsType,
  DicePickedType,
  dieTypes,
  loadDieTypes,
} from '../../types'
import validateDieType from '../../helpers/validateDieType';
import findObjectByKey, { typeKeys } from '../../helpers/findObjectByKey';


class Dice {
  mesh: Mesh | null = null
  result = 0
  asleep = false
  config: DiceConfigType
  id: number | string
  dieType: dieTypes
  comboKey: string
	d10Instance!: Dice
	dieParent!: Dice
  
  constructor(options: DiceConstructorType) {
    this.config = {...defaultOptions, ...options}
    this.id = this.config.id !== undefined ? this.config.id : Date.now()
		this.dieType = validateDieType(`d${this.config.sides}`)
    this.comboKey = `${this.dieType}_${this.config.theme}`

    this.createInstance()
  }

  createInstance() {
    const { scene } = this.config

    const instanceMesh =  scene?.getMeshByName(this.comboKey)
    //@ts-expect-error 'createInstance' does not exist on type 'AbstractMesh'
    const dieInstance = instanceMesh?.createInstance(`${this.dieType}-instance-${this.id}`)

    const hitBoxMesh = scene?.getMeshByName(`${this.dieType}_hitbox`)
    //@ts-expect-error 'createInstance' does not exist on type 'AbstractMesh'
    const dieHitbox = hitBoxMesh?.createInstance(`${this.dieType}-hitbox-${this.id}`)

    dieInstance.addChild(dieHitbox)

		// start the instance under the floor, out of camera view
		dieInstance.position.y = -100
		
    if(this.config.enableShadows){
			typeKeys(this.config.lights).forEach(key => {
				if ( key !== 'hemispheric' ) {
          //@ts-expect-error Property 'shadowGenerator' does not exist on type 'DirectionalLight'.
					this.config.lights[key]?.shadowGenerator?.addShadowCaster(dieInstance)
				}
			});
    }

    // attach the instance to the class object
    this.mesh = dieInstance
  }

  static async loadDie<T extends loadDieTypes>(options: T): Promise<T> {
    const { sides, theme = 'purpleRock', scene} = options
		const dieType = `d${sides}`
    // create a key for this die type and theme combo for caching and instance creation
    const comboKey = `${dieType}_${theme}`

    if (!scene?.getMeshByName(comboKey)) {
      const die = scene?.getMeshByName(dieType)?.clone(comboKey, null)
      const material = scene?.getMaterialByName(theme) 
      
      if (die && material) {
        die.material = material
      }
    }

    return options
  }

  // load all the dice models
  static async loadModels(options: DiceModelOptionsType) {
    const {assetPath, scene} = options
    const models = await SceneLoader.ImportMeshAsync(null,`${assetPath}models/`, "diceMeshes.babylon", scene)

    models.meshes.forEach(model => {
      if(model.id === "__root__") return
      model.setEnabled(false)
      //@ts-expect-error 'freezeNormals' does not exist on type 'AbstractMesh'
      model.freezeNormals()
    })
  }

  static async getRollResult(die: Dice) {
    const getDieRoll = ( d = die ) => new Promise((resolve,reject) => {
      const { dieType, mesh, config } = d
      const dieTypeObject = findObjectByKey(meshFaceIds, d.dieType)

			const vector = dieType === 'd4' ? new Vector3(0, -1, 0) : new Vector3(0, 1, 0)

      //@ts-expect-error Unresolved errors related to Babylon.JS types
			const picked: DicePickedType = config.scene?.pickWithRay(new Ray(mesh?.position, vector, 3))

      if ( !dieTypeObject ) {
        throw new Error("Dice: mesh face was nsot found")
      }

			const result: number = dieTypeObject[picked.faceId]

      d.result = result
  
      return resolve(result)
    })
    
    return await getDieRoll()
  }
}

export default Dice