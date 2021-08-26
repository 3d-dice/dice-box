// import { Mesh, PhysicsImpostor, SceneLoader, TransformNode, Vector3 } from '@babylonjs/core'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '@babylonjs/loaders/glTF/2.0/glTFLoader'
import '@babylonjs/core/Meshes/instancedMesh'

import { loadTheme } from './themes'

// caching some variables here
let meshes = {}, themes = {}, diceCombos = {}, count = 0
const defaultOptions = {
	theme: 'nebula',
	lights: [],
	enableShadows: false
}

class Dice {
  constructor(options) {
		// const {dieType = 'd20', theme = defaultTheme, ...rest}, sceneLights, enableShadows = options
		Object.assign(this, defaultOptions, options)
    this.id = options.id !== undefined ? options.id : count++
		this.dieType = `d${this.sides}`
    this.mesh = null
    this._result = null
    this.asleep = false
    this.comboKey = `${this.dieType}_${this.theme}`
    this.createInstance()
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
		// start the instance under the floor, out of camera view
		dieInstance.position.y = -100

    meshes[this.dieType].getChildTransformNodes().map(child => {
      const locator = child.clone(child.id)
      locator.setAbsolutePosition(child.getAbsolutePosition())
      dieInstance.addChild(locator)
    })
		
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

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
  static async loadDie(options) {
    const { sides, theme = defaultOptions.theme} = options
		let dieType = 'd' + sides
    // create a key for this die type and theme combo for caching and instance creation
    const comboKey = `${dieType}_${theme}`

    // load the theme first - each theme should contain the textures for all dice types
    if (!Object.keys(themes).includes(theme)) {
      themes[theme] = await loadTheme(theme)
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

  // load all the dice from a webWorker
  static async loadModels() {
    const models = await SceneLoader.ImportMeshAsync("", "/DiceBoxOffscreen/assets/models/diceMeshes.glb")
    // const model = await SceneLoader.ImportMeshAsync(["die","collider"], "./DiceBox/assets/models/", `d20.glb`)
    models.meshes.forEach(model => {
      // console.log(`model.id`, model.id)
      if(model.id === "__root__") return
      model.setEnabled(false)
      // model.receiveShadows = true
      model.freezeNormals()
      // model.scaling = new Vector3(1, 1, 1)
      meshes[model.id] = model
    })
    // return models
  }

  static async getRollResult(die) {
    const getDieRoll = (d=die) => new Promise((resolve,reject) => {
    // const getDieRoll = (d = die) => {
      let highestDot = -1
      let highestLocator
      for (let locator of d.mesh.getChildTransformNodes()) {
        const dot = locator.up.y
        if (dot > highestDot) {
          highestDot = dot
          highestLocator = locator
        }
      }

      // locators may have crazy names after being instanced, but they all end in '_##' for the face they are on
			const result = parseInt(highestLocator.name.slice(highestLocator.name.lastIndexOf('_')+1))
			die.result = result
      return resolve(result)
    })
    return await getDieRoll()
  }
}

export default Dice