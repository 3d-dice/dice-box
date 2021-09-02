import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'

async function loadStandardMaterial(theme,assetPath) {
  let diceMaterial = new StandardMaterial(theme);
  let diceTexture = await importTextureAsync(`${assetPath}themes/${theme}/albedo.jpg`)
  let diceBumpTexture = await importTextureAsync(`${assetPath}themes/${theme}/normal.jpg`)
	diceMaterial.diffuseTexture = diceTexture
	diceMaterial.diffuseTexture.level = 1.3
  diceMaterial.bumpTexture = diceBumpTexture
  diceMaterial.bumpTexture.level = 2
  // diceMaterial.invertNormalMapY = true

	// additional settings for .babylon file settings with Preserve Z-up right handed coordinate
	diceMaterial.diffuseTexture.vScale = -1
  diceMaterial.bumpTexture.vScale = -1

  diceMaterial.allowShaderHotSwapping = false

  // diceMaterial.freeze() // can not freeze until after first mesh
  return diceMaterial
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
    case 'galaxy':
    case 'gemstone':
    case 'glass':
    case 'iron':
    case 'nebula':
    case 'sunrise':
    case 'sunset':
    case 'walnut':
      material = await loadStandardMaterial(theme,assetPath)
      // material = await loadPBRMaterial(theme)
      return material
    default:
      material = await loadStandardMaterial(theme,assetPath)
      return material
  }
}

export { loadTheme, importTextureAsync }