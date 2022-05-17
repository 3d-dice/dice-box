import { createCanvas } from "./components/canvas";
// import WorldOffscreen from './components/world.offscreen'
import physicsWorker from "./components/physics.worker.js?worker&inline";
import { debounce } from "./helpers";

const defaultOptions = {
  id: `dice-canvas-${Date.now()}`, // set the canvas id
  enableShadows: true, // do dice cast shadows onto DiceBox mesh?
  delay: 10, // delay between dice being generated - 0 causes stuttering and physics popping
  gravity: 2, // note: high gravity will cause dice piles to jiggle
  startingHeight: 8, // height to drop the dice from - will not exceed the DiceBox height set by zoom
  spinForce: 4, // passed on to physics as an impulse force
  throwForce: 5, // passed on to physics as linear velocity
  scale: 4, // scale the dice
  theme: "diceOfRolling", // can be a hex color or a pre-defined theme such as 'purpleRock'
  offscreen: true, // use offscreen canvas browser feature for performance improvements - will fallback to false based on feature detection
  assetPath: "/assets/dice-box/", // path to 'ammo', 'models', 'themes' folders and web workers
  origin: location.origin,
};

class World {
  rollCollectionData = {};
  rollGroupData = {};
  rollDiceData = {};
  themeData = [];
  #collectionIndex = 0;
  #groupIndex = 0;
  #rollIndex = 0;
  #idIndex = 0;
  #DiceWorld;
  diceWorldInit;
  #DiceWorker;
  diceWorkerInit;
  onDieComplete = () => {};
  onRollComplete = () => {};
  onRemoveComplete = () => {};

  constructor(container, options = {}) {
    // extend defaults with options
    this.config = { ...defaultOptions, ...options };
    // if a canvas selector is provided then that will be used for the dicebox, otherwise a canvas will be created using the config.id
    this.canvas = createCanvas({
      selector: container,
      id: this.config.id,
    });
  }

  async #loadWorld() {
    if (
      "OffscreenCanvas" in window &&
      "transferControlToOffscreen" in this.canvas &&
      this.config.offscreen
    ) {
      // Ok to use offscreen canvas - transfer controll offscreen
      const WorldOffscreen = await import("./components/world.offscreen").then(
        (module) => module.default
      );
      // WorldOffscreen is just a container class that passes all method calls to the Offscreen Canvas worker
      this.#DiceWorld = new WorldOffscreen({
        canvas: this.canvas,
        options: this.config,
      });
    } else {
      if (this.config.offscreen) {
        console.warn(
          "This browser does not support OffscreenCanvas. Using standard canvas fallback."
        );
        this.config.offscreen = false;
      }
      // code splitting out WorldOnscreen. It's esentially the same as offscreenCanvas.worker.js but communicates with the main thread differently
      const WorldOnscreen = await import("./components/world.onscreen").then(
        (module) => module.default
      );
      this.#DiceWorld = new WorldOnscreen({
        canvas: this.canvas,
        options: this.config,
      });
    }
  }

  #connectWorld() {
    // create message channels for the two web workers to communicate through
    const channel = new MessageChannel();

    // set up a promise to be fullfilled when a message comes back from DiceWorld indicating init is complete
    this.#DiceWorld.init = new Promise((resolve, reject) => {
      this.diceWorldInit = resolve;
    });

    this.#DiceWorld.connect(channel.port1);

    // initialize physics world in which AmmoJS runs
    this.#DiceWorker = new physicsWorker();
    // set up a promise to be fullfilled when a message comes back from physics.worker indicating init is complete
    this.#DiceWorker.init = new Promise((resolve, reject) => {
      this.diceWorkerInit = resolve;
    });

    // Setup the connection: Port 2 is for diceWorker
    this.#DiceWorker.postMessage(
      {
        action: "connect",
      },
      [channel.port2]
    );
  }

  resizeWorld({ width, height }) {
    this.#DiceWorld.resize({
      width: width,
      height: height,
    });

    this.#DiceWorker.postMessage({
      action: "resize",
      width: width,
      height: height,
    });
  }

  async init() {
    await this.#loadWorld();
    this.#connectWorld();
    this.#DiceWorld.onInitComplete = () => {
      this.diceWorldInit();
    };
    // now that DiceWorld is ready we can attach our callbacks
    this.#DiceWorld.onRollResult = (result) => {
      const die = this.rollDiceData[result.rollId];
      const group = this.rollGroupData[die.groupId];
      const collection = this.rollCollectionData[die.collectionId];

      // map die results back to our rollData
      // since all rolls are references to this.rollDiceDate the values will be added to those objects
      group.rolls[die.rollId].value = result.value;

      // increment the completed roll count for this group
      collection.completedRolls++;
      // if all rolls are completed then resolve the collection promise - returning dice that were in this collection
      if (collection.completedRolls == collection.rolls.length) {
        // pull out roll.collectionId and roll.id? They're meant to be internal values
        collection.resolve(
          Object.values(collection.rolls).map(
            ({ collectionId, id, ...rest }) => rest
          )
        );
      }

      // trigger callback passing individual die result
      const { collectionId, id, ...returnDie } = die;
      this.onDieComplete(returnDie);
    };
    this.#DiceWorld.onRollComplete = () => {
      // trigger callback passing the roll results
      this.onRollComplete(this.getRollResults());
    };

    this.#DiceWorld.onDieRemoved = (rollId) => {
      // get die information from cache
      let die = this.rollDiceData[rollId];
      const collection = this.rollCollectionData[die.removeCollectionId];
      collection.completedRolls++;

      // remove this die from cache
      delete this.rollDiceData[die.rollId];

      // remove this die from it's group rolls
      const group = this.rollGroupData[die.groupId];
      delete group.rolls[die.rollId];

      // parse the group value now that the die has been removed from data
      const groupData = this.#parseGroup(die.groupId);
      // update the value and quantity values
      group.value = groupData.value;
      group.qty = groupData.rollsArray.length;

      // if all rolls are completed then resolve the collection promise - returning dice that were removed
      if (collection.completedRolls == collection.rolls.length) {
        collection.resolve(
          Object.values(collection.rolls).map(({ id, ...rest }) => rest)
        );
      }
      const { collectionId, id, removeCollectionId, ...returnDie } = die;
      this.onRemoveComplete(returnDie);
    };

    // initialize the AmmoJS physics worker
    this.#DiceWorker.postMessage({
      action: "init",
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
      options: this.config,
    });

    this.#DiceWorker.onmessage = (e) => {
      switch (e.data.action) {
        case "init-complete":
          this.diceWorkerInit(); // fulfill promise so other things can run
      }
    };

    // pomise.all to initialize both offscreenWorker and DiceWorker
    await Promise.all([this.#DiceWorld.init, this.#DiceWorker.init]);

    // make this method chainable
    return this;
  }

  // TODO: use getter and setter
  // change config options
  updateConfig(options) {
    const newConfig = { ...this.config, ...options };
    this.config = newConfig;
    // pass updates to DiceWorld
    this.#DiceWorld.updateConfig(newConfig);
    // pass updates to PhysicsWorld
    this.#DiceWorker.postMessage({
      action: "updateConfig",
      options: newConfig,
    });

    // make this method chainable
    return this;
  }

  clear() {
    // reset indexes
    this.#collectionIndex = 0;
    this.#groupIndex = 0;
    this.#rollIndex = 0;
    this.#idIndex = 0;
    // reset internal data objects
    this.rollCollectionData = {};
    this.rollGroupData = {};
    this.rollDiceData = {};
    // clear all rendered die bodies
    this.#DiceWorld.clear();
    // clear all physics die bodies
    this.#DiceWorker.postMessage({ action: "clearDice" });

    // make this method chainable
    return this;
  }

  hide() {
    this.canvas.style.display = "none";

    // make this method chainable
    return this;
  }

  show() {
    this.canvas.style.display = "block";
    this.resizeWorld({
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
    });
    // make this method chainable
    return this;
  }

  // TODO: pass data with roll - such as roll name. Passed back at the end in the results
  roll(notation, { theme = undefined, newStartPoint = true } = {}) {
    // note: to add to a roll on screen use .add method
    // reset the offscreen worker and physics worker with each new roll
    this.clear();
    const collectionId = this.#collectionIndex++;

    this.rollCollectionData[collectionId] = new Collection({
      id: collectionId,
      notation,
      theme,
      anustart: newStartPoint,
    });

    const parsedNotation = this.createNotationArray(notation);
    this.#makeRoll(parsedNotation, collectionId);

    // returns a Promise that is resolved in onRollComplete
    return this.rollCollectionData[collectionId].promise;
  }

  add(notation, { theme = undefined, newStartPoint = true } = {}) {
    const collectionId = this.#collectionIndex++;

    this.rollCollectionData[collectionId] = new Collection({
      id: collectionId,
      notation,
      theme,
      anustart: newStartPoint,
    });

    const parsedNotation = this.createNotationArray(notation);
    this.#makeRoll(parsedNotation, collectionId);

    // returns a Promise that is resolved in onRollComplete
    return this.rollCollectionData[collectionId].promise;
  }

  reroll(
    notation,
    { remove = false, hide = false, newStartPoint = true } = {}
  ) {
    // TODO: add hide if you want to keep the die result for an external parser

    // ensure notation is an array
    const rollArray = Array.isArray(notation) ? notation : [notation];

    // destructure out 'sides', 'theme', 'groupId', 'rollId' - basically just getting rid of value - could do ({value, ...rest}) => rest
    const cleanNotation = rollArray.map(({ value, ...rest }) => rest);

    if (remove === true) {
      this.remove(cleanNotation, { hide });
    }

    // .add will return a promise that will then be returned here
    return this.add(cleanNotation, { newStartPoint });
  }

  remove(notation, { hide = false } = {}) {
    // ensure notation is an array
    const rollArray = Array.isArray(notation) ? notation : [notation];

    const collectionId = this.#collectionIndex++;

    this.rollCollectionData[collectionId] = new Collection({
      id: collectionId,
      notation,
      rolls: rollArray,
    });

    // loop through each die to be removed
    rollArray.map((die) => {
      // add the collectionId to the die so it can be looked up in the callback
      this.rollDiceData[die.rollId].removeCollectionId = collectionId;
      // assign the id for this die from our cache - required for removal
      // die.id = this.rollDiceData[die.rollId].id - note: can appear in async roll result data if attached to die object
      let id = this.rollDiceData[die.rollId].id;
      // remove the die from the render - don't like having to pass two ids. rollId is passed over just so it can be passed back for callback
      this.#DiceWorld.remove({ id, rollId: die.rollId });
      // remove the die from the physics bodies
      this.#DiceWorker.postMessage({ action: "removeDie", id });
    });

    return this.rollCollectionData[collectionId].promise;
  }

  async loadTheme(theme) {
    if (this.themeData.includes(theme)) {
      return;
    } else {
      await this.#DiceWorld.loadTheme(theme);
      this.themeData.push(theme);
    }
  }

  // used by both .add and .roll - .roll clears the box and .add does not
  async #makeRoll(parsedNotation, collectionId) {
    const collection = this.rollCollectionData[collectionId];
    let anustart = collection.anustart;

    // loop through the number of dice in the group and roll each one
    parsedNotation.forEach(async (notation) => {
      const theme = notation.theme || collection.theme || this.config.theme;
      const rolls = {};
      const hasGroupId = notation.groupId !== undefined;
      let index;

      // load the theme prior to adding all the dice => give textures a chance to load so you don't see a flash of naked dice
      await this.loadTheme(theme);

      // TODO: should I validate that added dice are only joining groups of the same "sides" value - e.g.: d6's can only be added to groups when sides: 6? Probably.

      for (var i = 0, len = notation.qty; i < len; i++) {
        // id's start at zero and zero can be falsy, so we check for undefined
        let rollId =
          notation.rollId !== undefined ? notation.rollId : this.#rollIndex++;
        let id = notation.id !== undefined ? notation.id : this.#idIndex++;
        index = hasGroupId ? notation.groupId : this.#groupIndex;

        const roll = {
          sides: notation.sides,
          groupId: index,
          collectionId: collection.id,
          rollId,
          id,
          theme,
        };

        rolls[rollId] = roll;
        this.rollDiceData[rollId] = roll;
        collection.rolls.push(this.rollDiceData[rollId]);

        this.#DiceWorld.add({ ...roll, anustart });

        // turn flag off
        anustart = false;
      }

      if (hasGroupId) {
        Object.assign(this.rollGroupData[index].rolls, rolls);
      } else {
        // save this roll group for later
        notation.rolls = rolls;
        notation.id = index;
        this.rollGroupData[index] = notation;
        ++this.#groupIndex;
      }
    });
  }

  // accepts simple notations eg: 4d6
  // accepts array of notations eg: ['4d6','2d10']
  // accepts object {sides:int, qty:int}
  // accepts array of objects eg: [{sides:int, qty:int, mods:[]}]
  createNotationArray(input) {
    const notation = Array.isArray(input) ? input : [input];
    let parsedNotation = [];

    const verifyObject = (object) => {
      if (!object.hasOwnProperty("qty")) {
        object.qty = 1;
      }
      if (object.hasOwnProperty("sides")) {
        return true;
      } else {
        const err = "Roll notation is missing sides";
        throw new Error(err);
      }
    };

    const incrementId = (key) => {
      key = key.toString();
      let splitKey = key.split(".");
      if (splitKey[1]) {
        splitKey[1] = parseInt(splitKey[1]) + 1;
      } else {
        splitKey[1] = 1;
      }
      return splitKey[0] + "." + splitKey[1];
    };

    // verify that the rollId is unique. If not then increment it by .1
    // rollIds become keys in the rollDiceData object, so they must be unique or they will overright another entry
    const verifyRollId = (object) => {
      if (object.hasOwnProperty("rollId")) {
        if (this.rollDiceData.hasOwnProperty(object.rollId)) {
          object.rollId = incrementId(object.rollId);
        }
      }
    };

    // notation is an array of strings or objects
    notation.forEach((roll) => {
      // console.log('roll', roll)
      // if notation is an array of strings
      if (typeof roll === "string") {
        parsedNotation.push(this.parse(roll));
      } else if (typeof notation === "object") {
        verifyRollId(roll);
        verifyObject(roll) && parsedNotation.push(roll);
      }
    });

    return parsedNotation;
  }

  // parse text die notation such as 2d10+3 => {number:2, type:6, modifier:3}
  // taken from https://github.com/ChapelR/dice-notation
  parse(notation) {
    const diceNotation = /(\d+)[dD](\d+)(.*)$/i;
    const modifier = /([+-])(\d+)/;
    const cleanNotation = notation.trim().replace(/\s+/g, "");
    const validNumber = (n, err) => {
      n = Number(n);
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) {
        throw new Error(err);
      }
      return n;
    };

    const roll = cleanNotation.match(diceNotation);
    let mod = 0;
    const msg = "Invalid notation: " + notation + "";

    if (roll.length < 3) {
      throw new Error(msg);
    }
    if (roll[3] && modifier.test(roll[3])) {
      const modParts = roll[3].match(modifier);
      let basicMod = validNumber(modParts[2], msg);
      if (modParts[1].trim() === "-") {
        basicMod *= -1;
      }
      mod = basicMod;
    }

    roll[1] = validNumber(roll[1], msg);
    roll[2] = validNumber(roll[2], msg);

    return {
      qty: roll[1],
      sides: roll[2],
      modifier: mod,
    };
  }

  #parseGroup(groupId) {
    // console.log('groupId', groupId)
    const rollGroup = this.rollGroupData[groupId];
    // turn object into an array
    const rollsArray = Object.values(rollGroup.rolls).map(
      ({ collectionId, id, ...rest }) => rest
    );
    // add up the values
    // some dice may still be rolling, should this be a promise?
    // if dice are still rolling in the group then the value is undefined - hence the isNaN check
    let value = rollsArray.reduce((val, roll) => {
      const rollVal = isNaN(roll.value) ? 0 : roll.value;
      return val + rollVal;
    }, 0);
    // add the modifier
    value += rollGroup.modifier ? rollGroup.modifier : 0;
    // return the value and the rollsArray
    return { value, rollsArray };
  }

  getRollResults() {
    // loop through each roll group
    return Object.entries(this.rollGroupData).map(([key, val]) => {
      // parse the group data to get the value and the rolls as an array
      const groupData = this.#parseGroup(key);
      // set the value for this roll group in this.rollGroupData
      val.value = groupData.value;
      // set the qty equal to the number of rolls - this can be changed by rerolls and removals
      val.qty = groupData.rollsArray.length;
      // copy the group that will be put into the return object
      const groupCopy = { ...val };
      // replace the rolls object with a rolls array
      groupCopy.rolls = groupData.rollsArray;
      // return the groupCopy - note: we never return this.rollGroupData
      return groupCopy;
    });
  }
}

class Collection {
  constructor(options) {
    Object.assign(this, options);
    this.rolls = options.rolls || [];
    this.completedRolls = 0;
    const that = this;
    this.promise = new Promise((resolve, reject) => {
      that.resolve = resolve;
      that.reject = reject;
    });
  }
}

export default World;
