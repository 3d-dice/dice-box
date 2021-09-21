import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { MeshBuilder } from '@babylonjs/core'
import { Vector3 } from '@babylonjs/core/Maths/math'
import { Ray } from "@babylonjs/core/Culling/ray";
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
		// console.log(`diceCombos[this.comboKey]`, diceCombos[this.comboKey])
		// console.time('create instance')
    // create die instance
		// console.time('instance')
    const dieInstance = diceCombos[this.comboKey].createInstance(`${this.dieType}-instance-${count}`)
		// console.timeEnd('instance')

		// console.time('clone locators')
    // meshes[this.dieType].getChildTransformNodes().map((child,i) => {
		// 	// console.time('clone')
    //   const locator = child.clone(child.id)
    //   // const locator = diceCombos[this.comboKey]._children[i].createInstance()
		// 	// console.log(`locator`, locator)
		// 	// console.timeEnd('clone')
		// 	// console.time('setAbsolutePosition')
    //   locator.setAbsolutePosition(child.getAbsolutePosition())
		// 	// console.timeEnd('setAbsolutePosition')
		// 	// console.time('addChild')
    //   dieInstance.addChild(locator)
		// 	// console.timeEnd('addChild')
    // })
		// console.timeEnd('clone locators')
		// console.timeEnd('create instance')

		// console.time('create clone')
		// const dieClone = diceCombos[this.comboKey].clone()
		// console.timeEnd('create clone')

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

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
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

			// die.mesh.updateFacetData();
			// var positions = die.mesh.getFacetLocalPositions();
			// var normals = die.mesh.getFacetLocalNormals();
	
			// var lines = [];
			// for (var i = 0; i < positions.length; i++) {
			// 		var line = [ positions[i], positions[i].add(normals[i]) ];
			// 		lines.push(line);
			// }
			// var lineSystem = MeshBuilder.CreateLineSystem("ls", {lines: lines}, scene);
			// lineSystem.color = Color3.Green();
			// console.log(`created normals`)
    // const getDieRoll = (d = die) => {

			let vector = new Vector3(0, 1, 0);
			const picked = scene.pickWithRay(new Ray(die.mesh.position, vector, 10))
			console.log(`picked`, picked)
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