import { Color3 } from '@babylonjs/core/Maths/math.color'
import { CustomMaterial } from '@babylonjs/materials/custom/customMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Nullable, Scene, ThinEngine } from '@babylonjs/core';

const loadStandardMaterial = async (theme: string, assetPath: string, scene: Scene | undefined) => {
  let diceMaterial = new StandardMaterial(theme, scene);
  let diceTexture = await importTextureAsync(`${assetPath}themes/${theme}/albedo.jpg`, scene)
  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/${theme}/normal.jpg`, scene)

	diceMaterial.diffuseTexture = diceTexture
  diceMaterial.bumpTexture = diceBumpTexture

	sharedSettings(diceMaterial)

  return diceMaterial
}

const loadSemiTransparentMaterial = async (theme: string, assetPath: string, scene: Scene) => {
  let diceMaterial = new StandardMaterial(theme, scene);
  let diceTexture = await importTextureAsync(`${assetPath}themes/${theme}/albedo.jpg`,scene)
  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/${theme}/normal.jpg`,scene)
  let diceOpacityTexture = await importTextureAsync(`${assetPath}themes/${theme}/mask.png`,scene)
	diceMaterial.diffuseTexture = diceTexture
	diceMaterial.opacityTexture = diceOpacityTexture
	diceMaterial.opacityTexture.getAlphaFromRGB = true
  //@ts-expect-error Property 'vScale' does not exist on type 'BaseTexture'. Did you mean 'scale'?
  diceMaterial.opacityTexture.vScale = -1
  diceMaterial.bumpTexture = diceBumpTexture

	sharedSettings(diceMaterial)

  return diceMaterial
}

async function loadColorMaterial(theme: string, assetPath: string, scene: Scene) {
	let color = Color3.FromHexString(theme)
  let diceMaterial = new CustomMaterial(theme, scene);
	let diceTexture

	if ((color.r*256*0.299 + color.g*256*0.587 + color.b*256*0.114) > 175){
		diceTexture = await importTextureAsync(`${assetPath}themes/transparent/albedo-dark.png`,scene)
	} else {
		diceTexture = await importTextureAsync(`${assetPath}themes/transparent/albedo-light.png`,scene)
	}
	diceMaterial.diffuseTexture = diceTexture
	diceMaterial.Fragment_Custom_Diffuse(`
		baseColor.rgb = mix(vec3(${color.r},${color.g},${color.b}), baseColor.rgb, baseColor.a);
	`)

  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/transparent/normal.jpg`,scene)
  diceMaterial.bumpTexture = diceBumpTexture

	sharedSettings(diceMaterial)

  return diceMaterial
}

const sharedSettings = (material: StandardMaterial) => {
  if (material.diffuseTexture) material.diffuseTexture.level = 1.3
  if (material.bumpTexture) material.bumpTexture.level = 2
  material.invertNormalMapX = true

	// additional settings for .babylon file settings with Preserve Z-up right handed coordinate
   //@ts-expect-error Property 'vScale' does not exist on type 'BaseTexture'. Did you mean 'scale'?
	if (material.diffuseTexture) material.diffuseTexture.vScale = -1
   //@ts-expect-error Property 'vScale' does not exist on type 'BaseTexture'. Did you mean 'scale'?
  if (material.bumpTexture) material.bumpTexture.vScale = -1

  material.allowShaderHotSwapping = false
	return material
}


const importTextureAsync = async (url: Nullable<string>, scene: Nullable<Scene | ThinEngine> | undefined): Promise<Texture> => {
  return new Promise((resolve, reject) => {
    const texture: Texture = new Texture(
      url, // url: Nullable<string>
      scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
      undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
      false, // invertY?: boolean
      undefined, // samplingMode?: number
      () => resolve(texture), // onLoad?: Nullable<() => void>
      () => reject("Unable to load texture") // onError?: Nullable<(message?: string
    )
  })
}

const loadTheme = async (theme: string, p: string, s: Scene) => {
  let material
  if(theme.startsWith("#")){
    material = await loadColorMaterial(theme, p, s)
  } 
  else if(theme.toLowerCase().startsWith("trans")) {
    material = await loadSemiTransparentMaterial(theme, p, s)
  }
  else {
    material = await loadStandardMaterial(theme, p, s)
  }
  return material
}

export { loadTheme, importTextureAsync }