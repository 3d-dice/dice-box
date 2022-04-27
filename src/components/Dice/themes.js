import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { CustomMaterial } from '@babylonjs/materials/custom/customMaterial';
import { SerializationHelper } from '@babylonjs/core/Misc/decorators'

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
    const {basePath, theme, material: matParams} = options
    //TODO: apply more matParams
    const diceMaterial = new StandardMaterial(theme, this.scene);
    if(matParams.diffuseTexture){
      diceMaterial.diffuseTexture = await this.importTextureAsync(`${basePath}/${matParams.diffuseTexture}`,this.scene)
      if(matParams.diffuseLevel) {
        diceMaterial.diffuseTexture.level = matParams.diffuseLevel
      }
    }
    if(matParams.bumpTexture){
      diceMaterial.bumpTexture = await this.importTextureAsync(`${basePath}/${matParams.bumpTexture}`,this.scene)
      if(matParams.bumpLevel){
        diceMaterial.bumpTexture.level = matParams.bumpLevel
      }
    }
    if(matParams.specularTexture){
      diceMaterial.specularTexture = await this.importTextureAsync(`${basePath}/${matParams.specularTexture}`,this.scene)
      if(matParams.specularPower){
        diceMaterial.specularTexture.specularPower = matParams.specularPower
      }
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
    const {theme, basePath, material: matParams} = options
    // create the custom color material with white/light numbers
    const diceMatLight = new CustomMaterial(theme+'_light',this.scene)
    // Other fun params for the future
    // diceMatLight.useEmissiveAsIllumination = true
    // diceMatLight.useAlphaFromDiffuseTexture = true
    // diceMatLight.ambientColor = Color3.White()
    // diceMatLight.ambientTexture = diceTexture
    // diceMatLight.emissiveTexture = diceTexture
    // diceMatLight.opacityTexture = diceTexture
    if(matParams.diffuseTexture && matParams.diffuseTexture.light){
      diceMatLight.diffuseTexture = await this.importTextureAsync(`${basePath}/${matParams.diffuseTexture.light}`,this.scene)
      if(matParams.diffuseLevel) {
        diceMatLight.diffuseTexture.level = matParams.diffuseLevel
      }
    }
    if(matParams.bumpTexture){
      diceMatLight.bumpTexture = await this.importTextureAsync(`${basePath}/${matParams.bumpTexture}`,this.scene)
      if(matParams.bumpLevel){
        diceMatLight.bumpTexture.level = matParams.bumpLevel
      }
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
      diceMatDark.diffuseTexture = await this.importTextureAsync(`${basePath}/${matParams.diffuseTexture.dark}`,this.scene)
      if(matParams.diffuseLevel) {
        diceMatDark.diffuseTexture.level = matParams.diffuseLevel
      }
    }
    // this must be set again for some reason - does not clone
    diceMatDark.AddAttribute('customColor')
  }

  async importTextureAsync(url) {
    return new Promise((resolve, reject) => {
      let texture = new Texture(
        url, // url: Nullable<string>
        this.scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
        undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
        true, // invertY?: boolean
        undefined, // samplingMode?: number
        () => resolve(texture), // onLoad?: Nullable<() => void>
        () => reject("Unable to load texture") // onError?: Nullable<(message?: string
      )
    })
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