import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { CustomMaterial } from '@babylonjs/materials/custom/customMaterial';

async function loadStandardMaterial(theme,assetPath) {
  let diceMaterial = new StandardMaterial(theme);
  let diceTexture = await importTextureAsync(`${assetPath}themes/${theme}/albedo.jpg`)
  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/${theme}/normal.jpg`)
	diceMaterial.diffuseTexture = diceTexture
  diceMaterial.bumpTexture = diceBumpTexture

	sharedSettings(diceMaterial)

  return diceMaterial
}

async function loadSemiTransparentMaterial(theme,assetPath) {
  let diceMaterial = new StandardMaterial(theme);
  let diceTexture = await importTextureAsync(`${assetPath}themes/${theme}/albedo.jpg`)
  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/${theme}/normal.jpg`)
  let diceOpacityTexture = await importTextureAsync(`${assetPath}themes/${theme}/mask.png`)
	diceMaterial.diffuseTexture = diceTexture
	diceMaterial.opacityTexture = diceOpacityTexture
	diceMaterial.opacityTexture.getAlphaFromRGB = true
  diceMaterial.opacityTexture.vScale = -1
	// diceMaterial.backFaceCulling = false
  diceMaterial.bumpTexture = diceBumpTexture

	sharedSettings(diceMaterial)

  return diceMaterial
}

async function loadColorMaterial(theme,assetPath) {
	let color = Color3.FromHexString(theme)
  let diceMaterial = new CustomMaterial(theme);
	let diceTexture
	// console.log("color totals",(color.r*256*0.299 + color.g*256*0.587 + color.b*256*0.114))
	if ((color.r*256*0.299 + color.g*256*0.587 + color.b*256*0.114) > 175){
		diceTexture = await importTextureAsync(`${assetPath}themes/transparent/albedo-dark.png`)
	} else {
		diceTexture = await importTextureAsync(`${assetPath}themes/transparent/albedo-light.png`)
	}
	diceMaterial.diffuseTexture = diceTexture
	// diceMaterial.diffuseTexture.hasAlpha = true;
	// diceMaterial.useAlphaFromDiffuseTexture = true;
	diceMaterial.Fragment_Custom_Diffuse(`
		baseColor.rgb = mix(vec3(${color.r},${color.g},${color.b}), baseColor.rgb, baseColor.a);
	`)

  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/transparent/normal.jpg`)
  diceMaterial.bumpTexture = diceBumpTexture

	sharedSettings(diceMaterial)

  return diceMaterial
}

const sharedSettings = (material) => {
	material.diffuseTexture.level = 1.3
  material.bumpTexture.level = 2
  // material.invertNormalMapY = true
  material.invertNormalMapX = true

	// additional settings for .babylon file settings with Preserve Z-up right handed coordinate
	material.diffuseTexture.vScale = -1
  material.bumpTexture.vScale = -1
	// material.diffuseTexture.uScale = -1
  // material.bumpTexture.uScale = -1

  material.allowShaderHotSwapping = false
	return material
}



async function importTextureAsync(url) {
  return new Promise((resolve, reject) => {
    let texture = new Texture(
      url, // url: Nullable<string>
      null, // sceneOrEngine: Nullable<Scene | ThinEngine>
      undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
      false, // invertY?: boolean
      undefined, // samplingMode?: number
      () => resolve(texture), // onLoad?: Nullable<() => void>
      () => reject("Unable to load texture") // onError?: Nullable<(message?: string
    )
  })
}

const loadTheme = async (theme,assetPath) => {
  let material;
  switch (theme) {
    case 'purpleRock':
      material = await loadStandardMaterial(theme,assetPath)
      // material = await loadPBRMaterial(theme)
      return material
		case 'glass':
			material = await loadSemiTransparentMaterial(theme,assetPath)
      // material = await loadPBRMaterial(theme)
      return material
    default:
      material = await loadColorMaterial(theme,assetPath)
      return material
  }
}

export { loadTheme, importTextureAsync }