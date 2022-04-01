declare module "@3d-dice/dice-box" {
  type DiceboxConfig = {
    assetPath: string;
    delay: number;
    enableShadows: boolean;
    gravity: number;
    id: string;
    offscreen: boolean;
    origin: string;
    spinForce: number;
    startingHeight: number;
    theme: string;
    throwForce: number;
    zoomLevel: number;
  };

  type RollObject = {
    modifier?: number;
    qty: number;
    sides: number;
    theme?: string;
  };

  type RollNotation = string | string[] | RollObject | RollObject[];

  type DieResult = {
    groupId: number;
    id: number;
    result: number;
    rollId: number;
    sides: number;
    theme: string;
  };

  type RollResult = {
    id: number;
    modifier: number;
    rolls: DieResult[];
    theme: string;
    value: number;
  };

  class Dicebox {
    constructor(arg0: string, arg1?: DiceboxConfig);

    clear: () => void;
    init: () => Promise<Dicebox>;
    add: (arg: RollNotation) => Promise<RollResult[]>;
    roll: (arg: RollNotation) => Promise<RollResult[]>;

    reroll: (arg: DieResult) => Promise<RollResult[]>;
  }

  export = Dicebox;
}
