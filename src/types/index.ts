import { 
  AbstractMesh, 
  DirectionalLight, 
  HemisphericLight, 
  Nullable, 
  PointLight, 
  Scene, 
} from "@babylonjs/core";

export type dieTypes = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100"
export type sideType = 4 | 6 | 8 | 10 | 12 | 20 | 100
type meshKeys = "c4" | "c6" | "c8" | "c10" | "c12" | "c20"

export type StringNumber = string | number

export type groupIdType = number

export type rollIdType = number

type sideQty = {
  qty: number
  sides: number
}

export type groupRollIdTypes = { 
  groupId: groupIdType
  rollId: rollIdType 
}

export type configType = { 
  assetPath: string
  delay: number
  enableShadows: boolean
  gravity: number
  id: string
  offscreen: boolean
  origin: string
  spinForce: number
  startingHeight: number
  theme: string
  throwForce: number
  zoomLevel: number
}

export type postMessageType = {
  action: string
  height?: number
  id?: StringNumber
  options?: configType
  width?: number
}

export type onRollResultDieType = {
  result: number 
} & groupRollIdTypes


export type onRollCompleteType = (arg: rollGroupType[]) => rollType | void

export type onMessageType = {
  data: {
    action: string
  }
}

export type inputTypes = rerollType[]| parsedStringType | parsedStringType[] | string | string[] 

export type WorkerType = {
  init?: unknown,
} & Worker

export type DiceWorkerType = WorkerType

export type notationType = {
  id: StringNumber
  rollId: rollIdType
  rolls: rollType[]
} & sideQty

export type parsedStringType = {
  id: undefined
  modifier: number
  rollId: undefined
} & sideQty

export type diceType = {
  id: StringNumber
  sides: number
  theme: string
} & groupRollIdTypes

export type rollType = { 
  result: number
} & diceType

export type rollGroupType = {
  modifier: number
  rolls: rollType[]
  value: number
} & sideQty

export type rerollType = {
  qty: number
} & rollType

export type parsedNotationType = rerollType | parsedStringType | notationType

//Canvas worker types

export type offscreenCanvasConfigType = {
  assetPath: string
  delay: number 
  enableShadows: boolean
  origin: string
  zoomLevel: number
}

export type offscreenCanvasPostMessageType = {
  action: string
  diceBuffer?: ArrayBufferLike
  id?: StringNumber 
  sides?: StringNumber
}

export type physicsWorkerPortType = { 
  postMessage: (arg0: offscreenCanvasPostMessageType, arg1?: ArrayBufferLike[] ) => void
  onmessage: (e: any) => void 
}

export type initSceneDataType = { 
  canvas: HTMLCanvasElement
  height: number 
  options: configType
  width: number
}

//Physic worker types

export type physicWokrerConfigType = {
  origin: string
  assetPath: string
  startPosition: number[]
} & optionsType

export type optionsType ={ 
  angularDamping: number
  friction: number
  gravity: number
  linearDamping: number
  mass: number
  restitution: number
  settleTimeout: number
  spinForce: number
  startingHeight: number
  throwForce: number
  zoomLevel: number
}

export type dataType = { 
  height: number
  options: optionsType
  width: number
}

export type eventDataType = {
  action: string
  height: number
  id: string | number
  options: optionsType
  ports: unknown[]
  sides: sideType
  width: number
}

export type workWorkerEventType = { 
  action: string
  diceBuffer: Iterable<number>
  id: string | number
  sides: sideType
}

type subMeshes = {
  indexCount: number
  indexStart: number
  materialIndex: number
  verticesCount: number
  verticesStart: number
}

export type convexHulType = {
  Wh: number
}

export type meshType = { 
  billboardMode: number
  convexHull: convexHulType,
  id: meshKeys
  indices: number[]
  instances: unknown[]
  isEnabled: boolean
  isVisible: boolean
  name: meshKeys
  normals: number[]
  physicsFriction: number
  physicsMass: number
  physicsRestitution: number
  pickable: boolean
  position: number[]
  positions: number[]
  rotationQuaternion: number[]
  scaling: number[]
  subMeshes: subMeshes[]
  uvs: number[]
}

export type meshDataType = {
  autoClear: boolean
  clearColor: number[]
  gravity: number[]
  meshes: meshType[]
  producer: {
    exporter_version: string
    file: string
    name: string
    version: string
  }
}

export type sharedVector3Type = {
  setValue: (arg0: number, arg1: number, arg2: number) => unknown
}
export type physicsWorldType = {
  setGravity: (arg: sharedVector3Type) => void,
  addRigidBody: (arg: unknown) => unknown,
  removeRigidBody: (arg: unknown) => unknown,
  stepSimulation: (arg0: number, arg1: number, arg2: number) => unknown
}

export type collisionShapeType = {        
  Wh? : number            
  calculateLocalInertia? : (arg0: unknown, arg1: sharedVector3Type) => void 
}

export type createRigidBodyParamsType = {
  mass: number
  scaling?: number[]
  pos: number[]
  collisionFlags?: unknown
  quat?: number[]
  scale?: unknown
  friction?: unknown 
  restitution?: unknown
}

export type colliderType = {
  convexHull: convexHulType
  mass: number
  scaling: number[]
  pos: number[],
  physicsMass: number
}

export type collidersType = {
  [key in meshKeys]: meshType
}

export type removeDieDataType = { 
  action?: string
  height?: number
  id?: string | number 
  options?: unknown
  ports?: unknown[]
  sides?: unknown
  width?: number
}

export type rollDieType = {
  setLinearVelocity: (arg: unknown) => unknown,
  applyImpulse: (arg0: unknown, arg1: unknown) => unknown
}

export type sleepingBodyType = {
  id: string | number
}

export type bodyType = {
  asleep: true
  id: number
  timeout: number
  Wh: number
  getLinearVelocity?: () => {
    length: () => number
  }
  getAngularVelocity?: () => {
    length: () => number
  },
  setMassProps?: (arg: number) => unknown
  forceActivationState?: (arg: number) => unknown
  setLinearVelocity?: (arg: sharedVector3Type) => unknown
  setAngularVelocity?: (arg: sharedVector3Type) => unknown
  getMotionState?: () => {
    getWorldTransform: (arg: tmpBtTransType) => unknown
  }
}

export type tmpBtTransType = {
  getOrigin: () => {
    x: () => number
    y: () => number
    z: () => number
  }
  getRotation: () => {
    x: () => number
    y: () => number
    z: () => number
    w: () => number
  }
}

// world.offscreen & world.onscreen types
export type screenOptionsType = {
  canvas: HTMLCanvasElement
  options?: configType
}

export type offscreenOnMessageType = { 
  data: { 
    action: string
    id: number
    die: onRollResultDieType 
  } 
}

export type onscreenOnMessageType = { 
  data: { 
    action: string
    id: number
    diceBuffer: SharedArrayBuffer
  } 
}

export type offScreenResizeType = {
  height: number
  width: number
}

export type offscreenPromiseType = {
  id: string | number | symbol
  promise: (value?: unknown) => void
}

export type rollScreenType = {
  id: StringNumber
  sides: number
  theme: string
} & groupRollIdTypes

export type offScreenCanvasAddType = {
  scene: Scene
  lights: lightsType
} & rollScreenType

export type loadDieType = {
  scene: Scene
} & rollScreenType

export type  DiceConstructorType = {
  assetPath?: string
  enableShadows?: boolean
  lights: lightsType
} & loadDieType

//Dice.ts class Types
type shadowGeneratorType = {
  shadowGenerator?: {
    useCloseExponentialShadowMap: boolean,
    darkness: number
  },
}

export type directionalType = DirectionalLight & shadowGeneratorType

export type lightsType = {
  directional: directionalType
  hemispheric: HemisphericLight
}
export type lightsOptionsType = {
  enableShadows: boolean
  scene: Scene
}

export type pointedType = PointLight & shadowGeneratorType

export type DiceConfigType =  { 
  groupId: groupIdType
  id: null | StringNumber
  rollId: null | rollIdType
  scene: Scene | null
  sides: StringNumber
  theme: string
} & DiceConstructorType

export type DiceModelOptionsType = {
  assetPath: string,
  scene: Scene
}

export type DicePickedType = {
  aimTransform: null | unknown
  bu: number
  bv: number
  distance: number
  faceId: number
  gripTransform: null | unknown
  hit: boolean
  originMesh: Nullable<AbstractMesh>
  pickedMesh: Nullable<AbstractMesh>
  pickedPoint: {
    _isDirty: boolean
    _x: number
    _y: number
    _z: number
  }
  pickedSprite: null | unknown
  ray: {
    direction: {
      _isDirty: boolean
      _x: number
      _y: number
      _z: number
    }
    length: number
    origin: {
      _isDirty: boolean
      _x: number
      _y: number
      _z: number
    }
  }
  subMeshFaceId: number
  subMeshId: number
  thinInstanceIndex: number
  _pickingUnavailable: boolean
}

export type loadDieTypes = loadDieType | DiceConstructorType

export type connectTypes = Worker | MessagePort

//Dicebox types
export type DiceboxType = {
  aspect: number
  enableDebugging?: boolean
  enableShadows: boolean
  lights: lightsType
  scene: Scene
  zoomLevel: number
}