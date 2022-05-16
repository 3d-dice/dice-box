import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";

function sleeper(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

async function loadStandardMaterial(theme, assetPath, scene) {
  let diceMaterial = new StandardMaterial(theme, scene);
  let diceTexture = await importTextureAsync(
    `${assetPath}themes/${theme}/albedo.jpg`,
    scene
  );
  let diceBumpTexture = await importTextureAsync(
    `${assetPath}themes/${theme}/normal-dx.jpg`,
    scene
  );
  // let diceSpecTexture = await importTextureAsync(`${assetPath}themes/${theme}/specularity.jpg`,scene)
  diceMaterial.diffuseTexture = diceTexture;
  diceMaterial.bumpTexture = diceBumpTexture;
  // diceMaterial.specularTexture = diceSpecTexture
  // diceMaterial.specularPower = 1

  sharedSettings(diceMaterial);

  return diceMaterial;
}

async function loadSemiTransparentMaterial(theme, assetPath, scene) {
  let diceMaterial = new StandardMaterial(theme, scene);
  let diceTexture = await importTextureAsync(
    `${assetPath}themes/${theme}/albedo.jpg`,
    scene
  );
  let diceBumpTexture = await importTextureAsync(
    `${assetPath}themes/${theme}/normal-dx.jpg`,
    scene
  );
  let diceOpacityTexture = await importTextureAsync(
    `${assetPath}themes/${theme}/mask.png`,
    scene
  );
  diceMaterial.diffuseTexture = diceTexture;
  diceMaterial.opacityTexture = diceOpacityTexture;
  diceMaterial.opacityTexture.getAlphaFromRGB = true;
  diceMaterial.opacityTexture.vScale = -1;
  // diceMaterial.backFaceCulling = false
  diceMaterial.bumpTexture = diceBumpTexture;

  sharedSettings(diceMaterial);

  return diceMaterial;
}

async function loadColorMaterial(theme, assetPath, scene) {
  let color = Color3.FromHexString(theme);
  let diceMaterial = new CustomMaterial(theme, scene);
  let diceTexture;
  // console.log("color totals",(color.r*256*0.299 + color.g*256*0.587 + color.b*256*0.114))
  if (
    color.r * 256 * 0.299 + color.g * 256 * 0.587 + color.b * 256 * 0.114 >
    175
  ) {
    diceTexture = await importTextureAsync(
      `${assetPath}themes/transparent/albedo-dark.png`,
      scene
    );
  } else {
    diceTexture = await importTextureAsync(
      `${assetPath}themes/transparent/albedo-light.png`,
      scene
    );
  }
  diceMaterial.diffuseTexture = diceTexture;
  // diceMaterial.diffuseTexture.hasAlpha = true;
  // diceMaterial.useAlphaFromDiffuseTexture = true;
  diceMaterial.Fragment_Custom_Diffuse(`
		baseColor.rgb = mix(vec3(${color.r},${color.g},${color.b}), baseColor.rgb, baseColor.a);
	`);

  let diceBumpTexture = await importTextureAsync(
    `${assetPath}themes/transparent/normal-dx.jpg`,
    scene
  );
  diceMaterial.bumpTexture = diceBumpTexture;

  sharedSettings(diceMaterial);

  return diceMaterial;
}

const sharedSettings = (material) => {
  material.diffuseTexture.level = 1.3;
  // material.bumpTexture.level = 2
  // material.invertNormalMapY = true
  // material.invertNormalMapX = true

  // additional settings for .babylon file settings with Preserve Z-up right handed coordinate
  // material.diffuseTexture.vScale = -1
  // material.bumpTexture.vScale = -1
  // material.diffuseTexture.uScale = -1
  // material.bumpTexture.uScale = -1

  material.allowShaderHotSwapping = false;
  return material;
};

async function importTextureAsync(url, scene) {
  return new Promise((resolve, reject) => {
    let texture = new Texture(
      url, // url: Nullable<string>
      scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
      undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
      true, // invertY?: boolean
      undefined, // samplingMode?: number
      () => resolve(texture), // onLoad?: Nullable<() => void>
      () => reject("Unable to load texture") // onError?: Nullable<(message?: string
    );
  });
}

const loadTheme = async (theme, p, s) => {
  let material;
  if (theme.startsWith("#")) {
    material = await loadColorMaterial(theme, p, s);
  } else if (theme.toLowerCase().startsWith("trans")) {
    material = await loadSemiTransparentMaterial(theme, p, s);
  } else {
    // await sleeper(3000).then(async ()=>{
    material = await loadStandardMaterial(theme, p, s);
    // })
  }
  return material;
};

export { loadTheme, importTextureAsync };
