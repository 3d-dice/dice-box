import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math'
import { Ray } from "@babylonjs/core/Culling/ray";
import '../../helpers/babylonFileLoader'
import '@babylonjs/core/Meshes/instancedMesh'
import { meshFaceIds } from './meshFaceIds';

import { loadTheme } from './themes'

// caching some variables here
let meshes = {}, themes = {}, diceCombos = {}, count = 0
const defaultOptions = {
	theme: 'nebula',
	lights: [],
	enableShadows: false
}

class Dice {
  constructor(options,scene) {
		// const {dieType = 'd20', theme = defaultTheme, ...rest}, sceneLights, enableShadows = options
		Object.assign(this, defaultOptions, options)
    this.id = options.id !== undefined ? options.id : count++
		this.dieType = `d${this.sides}`
    this.mesh = null
    this._result = null
    this.asleep = false
    this.comboKey = `${this.dieType}_${this.theme}`
    this.createInstance()
		this.scene = scene
  }

	get result() {
    return this._result
  }

  set result(val) {
    this._result = val
  }

	static resetCount(){
		count = 0
	}

  createInstance() {
    // create die instance
    const dieInstance = diceCombos[this.comboKey].createInstance(`${this.dieType}-instance-${count}`)

    // meshes[this.dieType].getChildTransformNodes().map((child,i) => {
    //   const locator = child.clone(child.id)
    //   locator.setAbsolutePosition(child.getAbsolutePosition())
    //   dieInstance.addChild(locator)
    // })

		// start the instance under the floor, out of camera view
		dieInstance.position.y = -100
		
		//TODO: die is loading in the middle of the screen. flashes before animation starts
		// hide the die, reveal when it's ready to toss or after first update from physics
    if(this.enableShadows){
      for (const key in this.lights) {
        if(key !== 'hemispheric' ) {
          this.lights[key].shadowGenerator.addShadowCaster(dieInstance)
        }
      }
    }

    // attach the instance to the class object
    this.mesh = dieInstance

    // console.log(`count`, count)
    count++
	
  }

  static async loadDie(options) {
    const { sides, theme = defaultOptions.theme} = options
		let dieType = 'd' + sides
    // create a key for this die type and theme combo for caching and instance creation
    const comboKey = `${dieType}_${theme}`

    // load the theme first - each theme should contain the textures for all dice types
    if (!Object.keys(themes).includes(theme)) {
      themes[theme] = await loadTheme(theme, this.assetPath)
    }

    // cache die and theme combo for instances
    if (!Object.keys(diceCombos).includes(comboKey)) {
      const die = meshes[dieType].clone(comboKey)
      die.material = themes[theme]
      // die.material.freeze()
      diceCombos[comboKey] = die
    }

    return options
  }

  // load all the dice models
  static async loadModels(assetPath) {
		this.assetPath = assetPath
    const models = await SceneLoader.ImportMeshAsync(null,`${assetPath}models/`, "diceMeshes.babylon")

    models.meshes.forEach(model => {
      if(model.id === "__root__") return
      model.setEnabled(false)
      // model.receiveShadows = true
      model.freezeNormals()
      // model.scaling = new Vector3(1, 1, 1)
      meshes[model.id] = model
    })
    // return models
  }

  static async getRollResult(die,scene) {
    const getDieRoll = (d=die) => new Promise((resolve,reject) => {

			let vector = new Vector3(0, 1, 0);
			const picked = scene.pickWithRay(new Ray(die.mesh.position, vector, 3))

			die.result = meshFaceIds[die.dieType][picked.faceId]

      return resolve(die.result)
    })
    return await getDieRoll()
  }
}

export default Dice