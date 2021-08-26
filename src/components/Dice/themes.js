// import { StandardMaterial, Texture } from '@babylonjs/core'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
// import { PBRMaterial } from '@babylonjs/materials'
// import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";

async function loadStandardMaterial(theme) {
  let diceMaterial = new StandardMaterial(theme);
  let diceTexture = await importTextureAsync(`/DiceBoxOffscreen/assets/themes/${theme}/albedo.jpg`)
  let diceBumpTexture = await importTextureAsync(`/DiceBoxOffscreen/assets/themes/${theme}/normal.jpg`)
  // let diceTexture = new Texture(`./DiceBox/assets/themes/${theme}/albedo.jpg`)
  // let diceBumpTexture = new Texture(`./DiceBox/assets/themes/${theme}/normal.jpg`)
  diceMaterial.diffuseTexture = diceTexture
  // diceMaterial.backFaceCulling = true
  // diceMaterial.diffuseTexture.vScale = -1
  // diceMaterial.diffuseTexture.uScale = -1
  diceMaterial.diffuseTexture.level = 1.3
  diceMaterial.bumpTexture = diceBumpTexture
  // diceMaterial.bumpTexture.vScale = -1
  diceMaterial.bumpTexture.level = 2
  // diceMaterial.invertNormalMapX = true
  diceMaterial.invertNormalMapY = true
  diceMaterial.allowShaderHotSwapping = false
  // diceMaterial.freeze() // can not freeze until after first mesh
  return diceMaterial
}

// async function loadPBRMaterial(theme) {
//   let pbr = new PBRMaterial(theme);
//   pbr.albedoTexture = await importTextureAsync(`./DiceBox/assets/themes/${theme}/albedo.jpg`);
//   pbr.normalTexture = await importTextureAsync(`./DiceBox/assets/themes/${theme}/normal.jpg`);
//   pbr.metallicTexture = await importTextureAsync(`./DiceBox/assets/themes/${theme}/metalRoughness.jpg`);
//   pbr.useRoughnessFromMetallicTextureAlpha = false;
//   pbr.useRoughnessFromMetallicTextureGreen = true;
//   pbr.useMetallnessFromMetallicTextureBlue = true;
//   return pbr;
// }

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

const loadTheme = async (theme) => {
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
      material = await loadStandardMaterial(theme)
      // material = await loadPBRMaterial(theme)
      return material
    default:
      material = await loadStandardMaterial(theme)
      return material
  }
}

export { loadTheme, importTextureAsync }