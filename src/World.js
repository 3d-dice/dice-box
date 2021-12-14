import { createCanvas } from './components/canvas'
// import WorldOffscreen from './components/world.offscreen'
import physicsWorker from './components/physics.worker.js?worker&inline'
import { debounce } from './helpers'

const defaultOptions = {
	id: `dice-canvas-${Date.now()}`, // set the canvas id
  enableShadows: true, // do dice cast shadows onto DiceBox mesh?
  delay: 10, // delay between dice being generated - 0 causes stuttering and physics popping
	gravity: 3, // TODO: high gravity will cause dice piles to jiggle
	startingHeight: 15, // height to drop the dice from - will not exceed the DiceBox height set by zoom
	spinForce: 6, // passed on to physics as an impulse force
	throwForce: 2.5, // passed on to physics as linear velocity
	zoomLevel: 3, // 0-7, can we round it out to 9? And reverse it because higher zoom means closer
	theme: '#0974e6', // can be a hex color or a pre-defined theme such as 'purpleRock'
	offscreen: true, // use offscreen canvas browser feature for performance improvements - will fallback to false based on feature detection
	assetPath: '/assets/dice-box/', // path to 'ammo', 'models', 'themes' folders and web workers
	origin: location.origin,
}

class World {
	rollData = []
	themeData = []
	#groupIndex = 0
	#rollIndex = 0
	#idIndex = 0
	#DiceWorld
	diceWorldInit
	#DiceWorker
	diceWorkerInit
	onDieComplete = () => {}
	onRollComplete = () => {}

  constructor(container, options = {}){
		// extend defaults with options
		this.config = {...defaultOptions, ...options}
		// if a canvas selector is provided then that will be used for the dicebox, otherwise a canvas will be created using the config.id
    this.canvas = createCanvas({
      selector: container,
      id: this.config.id
    })

  }

	async #loadWorld(){
		if ("OffscreenCanvas" in window && "transferControlToOffscreen" in this.canvas && this.config.offscreen) { 
			// Ok to use offscreen canvas - transfer controll offscreen
			const WorldOffscreen = await import('./components/world.offscreen').then(module => module.default)
			// WorldOffscreen is just a container class that passes all method calls to the Offscreen Canvas worker
			this.#DiceWorld = new WorldOffscreen({
				canvas: this.canvas,
				options: this.config
			})
		} else {
			if(this.config.offscreen){
				console.warn("This browser does not support OffscreenCanvas. Using standard canvas fallback.")
				this.config.offscreen = false
			}
			// code splitting out WorldOnscreen. It's esentially the same as offscreenCanvas.worker.js but communicates with the main thread differently
			const WorldOnscreen = await import('./components/world.onscreen').then(module => module.default)
			this.#DiceWorld = new WorldOnscreen({
				canvas: this.canvas,
				options: this.config
			})
		}
	}

	#connectWorld(){
		// create message channels for the two web workers to communicate through
		const channel = new MessageChannel()

		// set up a promise to be fullfilled when a message comes back from DiceWorld indicating init is complete
		this.#DiceWorld.init = new Promise((resolve, reject) => {
			this.diceWorldInit = resolve
		})

		this.#DiceWorld.connect(channel.port1)

		// initialize physics world in which AmmoJS runs
		this.#DiceWorker = new physicsWorker()
		// set up a promise to be fullfilled when a message comes back from physics.worker indicating init is complete
		this.#DiceWorker.init = new Promise((resolve, reject) => {
			this.diceWorkerInit = resolve
		})

		// Setup the connection: Port 2 is for diceWorker
		this.#DiceWorker.postMessage({
			action: "connect"
		},[ channel.port2 ])
	}

	resizeWorld(){
		// send resize events to workers - debounced for performance
		const resizeWorkers = () => {
			this.#DiceWorld.resize({width: this.canvas.clientWidth, height: this.canvas.clientHeight})
			this.#DiceWorker.postMessage({action: "resize", width: this.canvas.clientWidth, height: this.canvas.clientHeight});
		}
		const debounceResize = debounce(resizeWorkers)
		window.addEventListener("resize", debounceResize)
	}

  async init() {
		await this.#loadWorld()
		this.#connectWorld()
		this.resizeWorld()

		this.#DiceWorld.onInitComplete = () => {
			this.diceWorldInit()
		}
		// now that DiceWorld is ready we can attach our callbacks
		this.#DiceWorld.onRollResult = (die) => {
			// map die results back to our rollData
			this.rollData[die.groupId].rolls[die.rollId].result = die.result
			// TODO: die should have 'sides' or is that unnecessary data passed between workers?
			// trigger callback passing individual die result
			this.onDieComplete(die)
		}
		this.#DiceWorld.onRollComplete = () => {
			this.rollData.forEach(rollGroup => {
				// convert rolls from indexed objects to array
				rollGroup.rolls = Object.values(rollGroup.rolls).map(roll => roll)
				// add up the values
				rollGroup.value = rollGroup.rolls.reduce((val,roll) => val + roll.result,0)
				// add the modifier
				rollGroup.value += rollGroup.modifier ? rollGroup.modifier : 0
			})
			// trigger callback passing the grouped roll data
			this.onRollComplete(this.rollData)
		}

    // initialize the AmmoJS physics worker
    this.#DiceWorker.postMessage({
      action: "init",
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
			options: this.config
    })

    this.#DiceWorker.onmessage = (e) => {
			switch( e.data.action ) {
				case "init-complete":
					this.diceWorkerInit() // fulfill promise so other things can run
			}
    }

    // pomise.all to initialize both offscreenWorker and DiceWorker
		await Promise.all([this.#DiceWorld.init, this.#DiceWorker.init])

		// make this method chainable
		return this

  }

	// TODO: use getter and setter
	// change config options
	updateConfig(options) {
		const newConfig = {...this.config,...options}
		this.config = newConfig
		// pass updates to DiceWorld
		this.#DiceWorld.updateConfig(newConfig)
		// pass updates to PhysicsWorld
		this.#DiceWorker.postMessage({
			action: 'updateConfig',
			options: newConfig
		})

		// make this method chainable
		return this
	}

	clear() {
		// reset indexes and rollData
		this.#rollIndex = 0
		this.#groupIndex = 0
		this.#idIndex = 0
		this.rollData = []
		// clear all rendered die bodies
		this.#DiceWorld.clear()
    // clear all physics die bodies
    this.#DiceWorker.postMessage({action: "clearDice"})

		// make this method chainable
		return this
  }

	hide() {
		this.canvas.style.display = 'none'

		// make this method chainable
		return this
	}

	show() {
		this.canvas.style.display = 'block'

		// make this method chainable
		return this
	}

	// add a die to another group. groupId should be included
  add(notation, groupId, theme) {
		if(typeof groupId === 'string' || theme) {
			this.config.theme = theme
		}
		let parsedNotation = this.createNotationArray(notation)
		this.#makeRoll(parsedNotation, groupId)

		// make this method chainable
		return this
  }

	reroll(die) {
		// TODO: add hide if you want to keep the die result for an external parser
		// TODO: reroll group
		// TODO: reroll array
		this.remove(die)
		die.qty = 1
		this.add(die, die.groupId)

		// make this method chainable
		return this
	}

	remove(die) {
		const {groupId, rollId, hide = false} = die
		// this will remove a roll from workers and rolldata
		// TODO: hide if you want to keep the die result for an external parser
		// delete the roll from cache
		// TODO: rollId should be the literal rollId on the rolls object, not pointing to an array index
		delete this.rollData[groupId].rolls[rollId]
		// remove the die from the render
		this.#DiceWorld.remove(die)
		// remove the die from the physics bodies - we do this in case there's a reroll. Don't want new dice interacting with a hidden physics body
		this.#DiceWorker.postMessage({action: "removeDie", id: rollId})

		// TODO: recalculate the group value
		// TODO: trigger onRollComplete again

		// make this method chainable
		return this
	}

  roll(notation, theme) {
		// to add to a roll on screen use .add method
    // reset the offscreen worker and physics worker with each new roll
    this.clear()
		if(theme) {
			this.config.theme = theme
		}
		let parsedNotation = this.createNotationArray(notation)
		this.#makeRoll(parsedNotation)

		// make this method chainable
		return this
  }

	async loadTheme(){
		if(this.themeData.includes(this.config.theme)){
			return
		} else {
			await this.#DiceWorld.loadTheme(this.config.theme)
			this.themeData.push(this.config.theme)
		}
	}

	// used by both .add and .roll - .roll clears the box and .add does not
	async #makeRoll(parsedNotation, groupId){
		const hasGroupId = groupId !== undefined

		// load the theme prior to adding all the dice => give textures a chance to load so you don't see a flash of naked dice
		await this.loadTheme()

		// loop through the number of dice in the group and roll each one
		parsedNotation.forEach(notation => {
			const rolls = {}
			// let index = hasGroupId ? groupId : this.#groupIndex
			let index

			for (var i = 0, len = notation.qty; i < len; i++) {
				// id's start at zero and zero can be falsy, so we check for undefined
				let rollId = notation.rollId !== undefined ? notation.rollId : this.#rollIndex++
				let id = notation.id !== undefined ? notation.id : this.#idIndex++
				index = hasGroupId ? groupId : this.#groupIndex

				const roll = {
					sides: notation.sides,
					groupId: index,
					rollId,
					id,
					theme: this.config.theme
				}

				rolls[rollId] = roll

				this.#DiceWorld.add(roll)

			}

			if(hasGroupId) {
				Object.assign(this.rollData[groupId].rolls, rolls)
			} else {
				// save this roll group for later
				notation.rolls = rolls
				this.rollData[index] = notation
				++this.#groupIndex
			}
		})
	}

	// accepts simple notations eg: 4d6
	// accepts array of notations eg: ['4d6','2d10']
	// accepts array of objects eg: [{sides:int, qty:int, mods:[]}]
	// accepts object {sides:int, qty:int}
	createNotationArray(notation){
		let parsedNotation = []

		if(typeof notation === 'string') {
			parsedNotation.push(this.parse(notation))
		}

		// notation is an array of strings or objects
		if(Array.isArray(notation)) {
			notation.forEach(roll => {
				// if notation is an array of strings
				if(typeof roll === 'string') {
					parsedNotation.push(this.parse(roll))
				}
				else {
					// TODO: ensure that there is a 'sides' and 'qty' value on the object - required for making a roll
					parsedNotation.push(roll)
				}
			})
		} else if(typeof notation === 'object'){
			// TODO: ensure that there is a 'sides' and 'qty' value on the object - required for making a roll
			parsedNotation.push(notation)
		}

		return parsedNotation
	}

  // parse text die notation such as 2d10+3 => {number:2, type:6, modifier:3}
  // taken from https://github.com/ChapelR/dice-notation
  parse(notation) {
    const diceNotation = /(\d+)[dD](\d+)(.*)$/i
    const modifier = /([+-])(\d+)/
    const cleanNotation = notation.trim().replace(/\s+/g, '')
    const validNumber = (n, err) => {
      n = Number(n)
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) {
        throw new Error(err);
      }
      return n
    }

    const roll = cleanNotation.match(diceNotation);
		let mod = 0;
    const msg = 'Invalid notation: ' + notation + '';

    if (roll.length < 3) {
      throw new Error(msg);
    }
    if (roll[3] && modifier.test(roll[3])) {
      const modParts = roll[3].match(modifier);
      let basicMod = validNumber(modParts[2], msg);
      if (modParts[1].trim() === '-') {
        basicMod *= -1;
      }
      mod = basicMod;
    }
    
    roll[1] = validNumber(roll[1], msg);
    roll[2] = validNumber(roll[2], msg);

    return {
      qty : roll[1],
      sides : roll[2],
      modifier : mod,
    }
  }

	getRollResults(){
		// calculate the value of all the rolls added together - advanced rolls such as 4d6dl1 (4d6 drop lowest 1) will require an external parser
		this.rollData.forEach(rollGroup => {
			// add up the values
			rollGroup.value = Object.values(rollGroup.rolls).reduce((val,roll) => val + roll.result,0)
			// add the modifier
			rollGroup.value += rollGroup.modifier ? rollGroup.modifier : 0
		})

		return this.rollData
	}
}

export default World