import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '../../helpers/babylonFileLoader'
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
    this.count = 0
    // this.id = options.id !== undefined ? options.id : this.count++
		// this.dieType = `d${this.sides}`
    // this.mesh = null
    this.meshes = {}
    this.themes = {}
    this.diceCombos = {}
    // this._result = null
    // this.asleep = false
    // this.comboKey = `${this.dieType}_${this.theme}`
    // this.createInstance()
  }

	// get result() {
  //   return this._result
  // }

  // set result(val) {
  //   this._result = val
  // }

	resetCount(){
		this.count = 0
	}

  createInstance(options) {

    // console.log(`dice options:`, options)

    const config = {...defaultOptions, ...options}

    console.log(`config`, config)
    // why id?
    const die = {
      ...config,
      id: config.id !== undefined ? config.id : this.count++,
      dieType: `d${config.sides}`
    }
    // const id = config.id !== undefined ? config.id : this.count++
    const dieType = `d${config.sides}`
    const comboKey = `d${config.sides}_${config.theme}`
    // create die instance
    const dieInstance = this.diceCombos[comboKey].createInstance(`${dieType}-instance-${this.count}`)

    this.meshes[die.dieType].getChildTransformNodes().map(child => {
      const locator = child.clone(child.id)
      locator.setAbsolutePosition(child.getAbsolutePosition())
      dieInstance.addChild(locator)
    })

		// start the instance under the floor, out of camera view
		dieInstance.position.y = -100
		dieInstance.position.x = this.count * -2.5
		
		//TODO: die is loading in the middle of the screen. flashes before animation starts
		// hide the die, reveal when it's ready to toss or after first update from physics
    if(config.enableShadows){
      for (const key in config.lights) {
        if(key !== 'hemispheric' ) {
          config.lights[key].shadowGenerator.addShadowCaster(dieInstance)
        }
      }
    }

    // attach the instance to the class object
    die.mesh = dieInstance

    // console.log(`count`, count)
    this.count++

    return die
  }

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
  async loadDie(options) {
    const { sides, theme = defaultOptions.theme, scene, engine} = options
		let dieType = 'd' + sides
    // create a key for this die type and theme combo for caching and instance creation
    const comboKey = `${dieType}_${theme}`

    // load the theme first - each theme should contain the textures for all dice types
    if (!Object.keys(this.themes).includes(theme)) {
      this.themes[theme] = await loadTheme(theme, this.assetPath, scene, engine)
    }

    // cache die and theme combo for instances
    if (!Object.keys(this.diceCombos).includes(comboKey)) {
      const die = this.meshes[dieType].clone(comboKey)
      die.material = scene.getMaterialByName(theme)
      // die.material.freeze()
      this.diceCombos[comboKey] = die
    }

    return options
  }

  // load all the dice models
  async loadModels(assetPath,scene) {
		this.assetPath = assetPath
    const models = await SceneLoader.ImportMeshAsync(null,`${assetPath}models/`, "diceMeshes.babylon", scene)

    models.meshes.forEach(model => {
      if(model.id === "__root__") return
      model.setEnabled(false)
      // model.receiveShadows = true
      model.freezeNormals()
      // model.scaling = new Vector3(1, 1, 1)
      this.meshes[model.id] = model
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