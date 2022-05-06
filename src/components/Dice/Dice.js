import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Ray } from "@babylonjs/core/Culling/ray";
// import { RayHelper } from '@babylonjs/core/Debug';
import '../../helpers/babylonFileLoader'
import '@babylonjs/core/Meshes/instancedMesh'


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

// TODO: this would probably be better as a factory pattern
class Dice {
  // mesh = null
  value = 0
  asleep = false
  constructor(options, scene) {
    this.config = {...defaultOptions, ...options}
    this.id = this.config.id !== undefined ? this.config.id : Date.now()
		this.dieType = `d${this.config.sides}`
    this.comboKey = `${this.config.theme}_${this.dieType}`
    this.scene = scene
    this.createInstance()
  }

  createInstance() {
    const { colorSuffix, color } = Dice.parseColor(this.config.themeColor)

    // piece together the name of the die we want to instance
    const targetDie = `${this.config.meshName}_${this.dieType}_${this.config.theme}${colorSuffix}`
    // create a new unique name for this instance
    const instanceName = `${targetDie}-instance-${this.id}`
    // create the instance
    const dieInstance = this.scene.getMeshByName(targetDie).createInstance(instanceName)

    if(color){
      dieInstance.instancedBuffers.customColor = color
    }

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

  static parseColor(themeColor){
    let colorSuffix = ''
    let color = themeColor ? Color3.FromHexString(themeColor) : undefined
    if (color && (color.r*256*0.299 + color.g*256*0.587 + color.b*256*0.114) > 175){
      colorSuffix = '_dark'
    } else {
      colorSuffix = '_light'
    }
    return {colorSuffix, color}
  }

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
  static async loadDie(options, scene) {
    const { sides, theme = 'default', themeColor, meshName} = options
    const { colorSuffix } = Dice.parseColor(themeColor)

    // create a key for this die type and theme for caching and instance creation
    const dieMeshName = meshName + '_d' + sides
    const dieMaterialName = dieMeshName + '_' + theme + colorSuffix
    let die = scene.getMeshByName(dieMaterialName)

    if (!die) {
      die = scene.getMeshByName(dieMeshName).clone(dieMaterialName)
    }
    if(!die.material) {
      if(themeColor){
        if (colorSuffix === '_dark'){
          die.material = scene.getMaterialByName(theme + '_dark')
        } else {
          die.material = scene.getMaterialByName(theme + '_light')
        }
        die.registerInstancedBuffer("customColor", 3)
      } else {
        die.material = scene.getMaterialByName(theme)
      }
      // die.material.freeze()
    }

    return options
  }

  // load all the dice models
  static async loadModels(options, scene) {
    // can we get scene without passing it in?
    const {meshFilePath, meshName, scale} = options
    let has_d100 = false

    //TODO: cache model files so it won't have to be fetched by other themes using the same models
    // using fetch to get modelData so we can pull out data unrelated to mesh importing
    const modelData = await fetch(`${meshFilePath}`).then(resp => {
      if(resp.ok) {
        const contentType = resp.headers.get("content-type")
        if (contentType && contentType.indexOf("application/json") !== -1) {
          return resp.json()
        } 
        else if (resp.type && resp.type === 'basic') {
          return resp.json()
        }
        else {
          // return resp
          throw new Error(`Incorrect contentType: ${contentType}. Expected "application/json" or "basic"`)
        }
      } else {
        throw new Error(`Unable to load 3D mesh file: '${meshFilePath}'. Request rejected with status ${resp.status}: ${resp.statusText}`)
      }
    }).catch(error => console.error(error))

    if(!modelData){
      return
    }

    SceneLoader.ImportMeshAsync(null,null, 'data:' + JSON.stringify(modelData) , scene).then(data => {
      data.meshes.forEach(model => {
        if(model.name === "__root__") {
          model.dispose()
        }
        // shrink the colliders
        if( model.name.includes("collider")) {
          model.scaling = new Vector3(.7,.7,.7)
        }
        // check if d100 is available as a mesh - otherwise we'll clone a d10
        if (!has_d100) {
          has_d100 = model.name === "d100"
        }
        model.setEnabled(false)
        model.freezeNormals()
        model.isPickable = false
        model.doNotSyncBoundingInfo = true
        // prefix all the meshs ids from this file with the file name so we can find them later e.g.: 'default-dice_d10' and 'default-dice_d10_collider'
        // model.id = meshName + '_' + model.id
        model.name = meshName + '_' + model.name
      })
      if(!has_d100) {
        // console.log("create a d100 from a d10")  
        scene.getMeshByName(meshName + '_d10').clone(meshName + '_d100')
        scene.getMeshByName(meshName + '_d10_collider').clone(meshName + '_d100_collider')
      }
      // save colliderFaceMap to scene - couldn't find a better place to stash this
      scene.colliderFaceMaps[meshName] = modelData.colliderFaceMap
    })
    // return collider data so it can be passed to physics
    // TODO: return any physics settings as well
    return modelData.meshes.filter(model => model.name.includes("collider"))
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

  static async getRollResult(die,scene) {
    // TODO: Why a function in a function?? fix this
    const getDieRoll = (d=die) => new Promise((resolve,reject) => {
      
      const meshFaceIds = scene.colliderFaceMaps[die.config.meshName]

      // const dieHitbox = d.config.scene.getMeshByName(`${d.dieType}_collider`).createInstance(`${d.dieType}-hitbox-${d.id}`)
      const dieHitbox = scene.getMeshByName(`${die.config.meshName}_${d.dieType}_collider`).createInstance(`${die.config.meshName}_${d.dieType}-hitbox-${d.id}`)
      dieHitbox.isPickable = true
      dieHitbox.isVisible = true
      dieHitbox.setEnabled(true)
      dieHitbox.position = d.mesh.position
      dieHitbox.rotationQuaternion = d.mesh.rotationQuaternion

			const vector = d.dieType === 'd4' ? Dice.setVector3(0, -1, 0) : Dice.setVector3(0, 1, 0)

      Dice.ray.direction = vector
      Dice.ray.origin = die.mesh.position

      const picked = scene.pickWithRay(Dice.ray)

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