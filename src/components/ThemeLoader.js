import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { CustomMaterial } from '@babylonjs/materials/custom/customMaterial';
import { SerializationHelper } from '@babylonjs/core/Misc/decorators'
import { deepCopy } from '../helpers'

// this is a monkey patch for cloning CustomMaterial in BabylonJS
CustomMaterial.prototype.clone = function (name)  {
  const th = this
  const result = SerializationHelper.Clone(() => new CustomMaterial(name, this.getScene()), this)

  result.name = name
  result.id = name  
  result.CustomParts.Fragment_Begin = th.CustomParts.Fragment_Begin
  result.CustomParts.Fragment_Definitions = th.CustomParts.Fragment_Definitions
  result.CustomParts.Fragment_MainBegin = th.CustomParts.Fragment_MainBegin
  result.CustomParts.Fragment_Custom_Diffuse = th.CustomParts.Fragment_Custom_Diffuse
  result.CustomParts.Fragment_Before_Lights = th.CustomParts.Fragment_Before_Lights
  result.CustomParts.Fragment_Before_Fog = th.CustomParts.Fragment_Before_Fog
  result.CustomParts.Fragment_Custom_Alpha = th.CustomParts.Fragment_Custom_Alpha
  result.CustomParts.Fragment_Before_FragColor = th.CustomParts.Fragment_Before_FragColor
  result.CustomParts.Vertex_Begin = th.CustomParts.Vertex_Begin
  result.CustomParts.Vertex_Definitions = th.CustomParts.Vertex_Definitions
  result.CustomParts.Vertex_MainBegin = th.CustomParts.Vertex_MainBegin
  result.CustomParts.Vertex_Before_PositionUpdated = th.CustomParts.Vertex_Before_PositionUpdated
  result.CustomParts.Vertex_Before_NormalUpdated = th.CustomParts.Vertex_Before_NormalUpdated
  result.CustomParts.Vertex_After_WorldPosComputed = th.CustomParts.Vertex_After_WorldPosComputed
  result.CustomParts.Vertex_MainEnd = th.CustomParts.Vertex_MainEnd 

  return result
}

class ThemeLoader {
  loadedThemes = {}
  themeData = {}
  constructor(options) {
    this.scene = options.scene
  }

  async loadStandardMaterial(options) {
    const {theme, material: matParams} = options
    //TODO: apply more matParams
    const diceMaterial = new StandardMaterial(theme, this.scene);

    // TODO: make these methods reusable getDiffuseTexture(matParams, material)
    if(matParams.diffuseTexture){
      diceMaterial.diffuseTexture = await this.getTexture('diffuse', options)
    }
    if(matParams.bumpTexture){
      diceMaterial.bumpTexture = await this.getTexture('bump', options)
    }
    if(matParams.specularTexture){
      diceMaterial.specularTexture = await this.getTexture('specular', options)
    }

    diceMaterial.allowShaderHotSwapping = false

    // other fun params for the future
    // diceMaterial.useAlphaFromDiffuseTexture
    // diceMaterial.useEmissiveAsIllumination
    // diceMaterial.opacityTexture
    // diceMaterial.emissiveTexture
    // diceMaterial.ambientTexture
    // diceMaterial.reflectionTexture
    // diceMaterial.refractionTexture
    // diceMaterial.lightmapTexture

  }

  // this will create two materials - one with light text and one with dark text, the underlying color can be changed by color instance buffers
  async loadColorMaterial(options) {
    const {theme, material: matParams} = options
    // create the custom color material with white/light numbers
    const diceMatLight = new CustomMaterial(theme+'_light',this.scene)
    // Other fun params for the future
    // diceMatLight.useEmissiveAsIllumination = true
    // diceMatLight.useAlphaFromDiffuseTexture = true
    // diceMatLight.ambientColor = Color3.White()
    // diceMatLight.ambientTexture = diceTexture
    // diceMatLight.emissiveTexture = diceTexture
    // diceMatLight.opacityTexture = diceTexture
    const opts = deepCopy(options)
    if(matParams.diffuseTexture && matParams.diffuseTexture.light){
      opts.material.diffuseTexture = options.material.diffuseTexture.light
      diceMatLight.diffuseTexture = await this.getTexture('diffuse', opts)
    }
    if(matParams.bumpTexture){
      diceMatLight.bumpTexture = await this.getTexture('bump', options)
    }
    if(matParams.specularTexture){
      diceMatLight.specularTexture = await this.getTexture('specular', options)
    }
  
    diceMatLight.allowShaderHotSwapping = false
  
    // the magic that allows for the material color to be changed on instances
    diceMatLight.Vertex_Definitions(`
      attribute vec3 customColor;
      varying vec3 vColor;
    `)
    .Vertex_MainEnd(`
      vColor = customColor;
    `)
    .Fragment_Definitions(`
      varying vec3 vColor;
    `)
    .Fragment_Custom_Diffuse(`
      baseColor.rgb = mix(vColor.rgb, baseColor.rgb, baseColor.a);
    `)

    diceMatLight.AddAttribute('customColor')
  
    // create the custom color material with black/dark numbers
    const diceMatDark = diceMatLight.clone(theme+'_dark')
    if(matParams.diffuseTexture && matParams.diffuseTexture.dark){
      opts.material.diffuseTexture = options.material.diffuseTexture.dark
      diceMatDark.diffuseTexture = await this.getTexture('diffuse', opts)
    }
    // this must be set again for some reason - does not clone
    diceMatDark.AddAttribute('customColor')
  }

  async getTexture(type, options){
    const {basePath, material: matParams, theme} = options
    let texture
    const level = type + 'Level'
    const textureKey = type + 'Texture'
    // const power = type + 'Power'
    try {        
      switch (type) {
        case "diffuse":
          texture = await this.importTextureAsync(`${basePath}/${matParams[textureKey]}`, theme)
          if(matParams[level]) {
            texture.level = matParams[level]
          }
          break;
        case "bump":
          texture = await this.importTextureAsync(`${basePath}/${matParams[textureKey]}`, theme)
          if(matParams[level]) {
            texture.level = matParams[level]
          }
          break;
        case "specular":    
            texture = await this.importTextureAsync(`${basePath}/${matParams[textureKey]}`, theme)
            if(matParams.specularPower){
              texture.specularPower = matParams.specularPower
            }
          break;
      
        default:
          throw new Error(`Texture type: ${type} is not supported`)
      }
    } catch (error) {
      console.error(error)
    }
    return texture
  }

  async importTextureAsync(url,theme) {
    return new Promise((resolve, reject) => {
      let fileName = url.match(/^(.*\/)(.*)$/)
      let texture = new Texture(
          url, // url: Nullable<string>
          this.scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
          undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
          true, // invertY?: boolean
          undefined, // samplingMode?: number
          () => resolve(texture), // onLoad?: Nullable<() => void>
          () => reject(`Unable to load texture '${fileName[2]}' for theme: '${theme}'. Check that your assetPath is configured correctly and that the files exist at path: '${fileName[1]}'`) // onError?: Nullable<(message?: string
        )
    }).catch(error => console.error(error))
  }

  async load(options){
    const { material } = options

    if(material.type === "color") {
      await this.loadColorMaterial(options)
    } 
    else if (material.type === "standard") {
      await this.loadStandardMaterial(options)
    } 
    //TODO: more material options
    // else if (material.type === "semiTransparent") {
    //   await this.loadSemiTransparentMaterial(options)
    // }
    else {
      console.error(`Material type: ${material.type} not supported`)
    }
  }
}


export default ThemeLoader