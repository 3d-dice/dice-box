//https://fantasticdice.games/docs/usage/objects
declare module "@3d-dice/dice-box" {
  type DiceboxConfig = {
    id?: string;
    enableShadows?: boolean;
    shadowTransparency?: number;
    lightIntensity?: number;
    delay?: number;
    scale?: number;
    theme?: string;
    themeColor?: string;
    offscreen?: boolean;
    assetPath?: string;
    origin?: string;
    meshFile?: string;
    suspendSimulation?: boolean;
  };

  type DieResult = {
    groupId: number;
    rollId: number;
    sides: number;
    theme: string;
    themeColor: string;
    value: number;
  };

  type DiceboxRollObject = {
    modifier?: number;
    qty?: number;
    sides: number | string;
    theme?: string;
    themeColor?: string;
  };

  type RollNotation = string | DiceboxRollObject[];

  type RollParameter =
    | RollNotation
    | DiceboxRollObject
    | DiceboxRollObject[]
    | DieResult;

  class Dicebox {
    constructor(arg0: string, arg1?: DiceboxConfig);

    resizeWorld: (size: { width: number; height: number }) => void;
    clear: () => void;
    hide: () => void;
    show: () => void;
    init: () => Promise<Dicebox>;
    add: (arg: RollParameter) => Promise<DieResult[]>;
    roll: (arg: RollParameter) => Promise<DieResult[]>;

    reroll: (arg: RollParameter) => Promise<DieResult[]>;
  }

  export = Dicebox;
}
