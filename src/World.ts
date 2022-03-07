import { createCanvas } from './components/createCanvas'
import { debounce } from './helpers'
import createNotationArray from "./helpers/createNotationArray"
import defaultOptions from "./defaultOptions"
import WorldOffScreen from './components/world.offscreen'
import WorldOnscreen from './components/world.onscreen'

import { 
	DiceWorkerType,
  configType,
  groupIdType,
  inputTypes,
  onMessageType,
  onRollCompleteType,
  onRollResultDieType,
  parsedNotationType,
  rollGroupType,
  rollType,
} from './types'

//@ts-expect-error
import physicsWorker from './components/physics/physics.worker.ts?worker&inline'

class World {
	rollData: rollGroupType[] = []
	themeData: string[] = []
	#groupIndex = 0
	#rollIndex = 0
	#idIndex = 0
	#DiceWorld?: WorldOffScreen | WorldOnscreen
	diceWorldInit: ((arg?: unknown) => void) | undefined
  #DiceWorker?: DiceWorkerType
	diceWorkerInit: ((arg?: unknown) => void) | undefined
	onDieComplete = (die: onRollResultDieType) => {}
	onRollComplete: onRollCompleteType = (arg: rollGroupType[]) => {}
  config: configType
  canvas: HTMLCanvasElement

  constructor(container: string, options = {} ){
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
			// code splitting out WorldOnscreen. 
			// It's esentially the same as offscreenCanvas.worker.js
			// It communicates with the main thread differently
			const WorldOnscreen = await import('./components/world.onscreen').then(module => module.default)

			this.#DiceWorld = new WorldOnscreen({
				canvas: this.canvas,
				options: this.config
			})
		}
	}

	async #connectWorld(){
		// create message channels for the two web workers to communicate through
		const channel = new MessageChannel()

		// set up a promise to be fullfilled when a message comes back from DiceWorld indicating init is complete
		if ( this.#DiceWorld ) this.#DiceWorld.init = new Promise((resolve, reject) => {
			this.diceWorldInit = resolve
		})

		this.#DiceWorld?.connect(channel.port1)

		// initialize physics world in which AmmoJS runs
		this.#DiceWorker = new physicsWorker()

		// set up a promise to be fullfilled when a message comes back from physics.worker indicating init is complete
		if (this.#DiceWorker) this.#DiceWorker.init = await new Promise((resolve, reject) => {
			this.diceWorkerInit = resolve
		})

		// Setup the connection: Port 2 is for diceWorker
		this.#DiceWorker?.postMessage({
			action: "connect"
		},[ channel.port2 ])
	}

	resizeWorld(){
		// send resize events to workers - debounced for performance
		const resizeWorkers = () => {
			this.#DiceWorld?.resize({
        height: this.canvas.clientHeight,
        width: this.canvas.clientWidth, 
      })
			this.#DiceWorker?.postMessage({
        action: "resize", 
        height: this.canvas.clientHeight,
        width: this.canvas.clientWidth, 
      });
		}
		const debounceResize = debounce(resizeWorkers)
		window.addEventListener("resize", debounceResize)
	}

  async init() {
		await this.#loadWorld()
		this.#connectWorld()
		this.resizeWorld()

		if ( this.#DiceWorld ) this.#DiceWorld.onInitComplete = () => {
      this.diceWorldInit && this.diceWorldInit()
		}
		
		// now that DiceWorld is ready we can attach our callbacks
		if ( this.#DiceWorld ) this.#DiceWorld.onRollResult = (die: onRollResultDieType ) => {
      const { groupId, rollId } = die
			// map die results back to our rollData
			this.rollData[groupId].rolls[rollId].result = die.result
			// trigger callback passing individual die result
			this.onDieComplete(die)
		}
		if ( this.#DiceWorld ) this.#DiceWorld.onRollComplete = () => {
			this.rollData.forEach(( rollGroup: rollGroupType ) => {
				// convert rolls from indexed objects to array
				rollGroup.rolls = Object.values(rollGroup.rolls).map(roll => roll)
				// add up the values
				rollGroup.value = rollGroup.rolls.reduce((val,roll) => val + roll.result, 0)
				// add the modifier
				rollGroup.value += rollGroup.modifier ? rollGroup.modifier : 0
			})
			// trigger callback passing the grouped roll data
			this.onRollComplete(this.rollData)
		}

    // initialize the AmmoJS physics worker
    this.#DiceWorker?.postMessage({
      action: "init",
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
			options: this.config
    })

    if ( this.#DiceWorker ) this.#DiceWorker.onmessage = (e: onMessageType) => {
			switch( e.data.action ) {
				case "init-complete":
					this.diceWorkerInit && this.diceWorkerInit() // fulfill promise so other things can run
			}
    }

    // promise.all to initialize both offscreenWorker and DiceWorker
		await Promise.all([this.#DiceWorld?.init, this.#DiceWorker?.init])

		// make this method chainable
		return this
  }

	// change config options
	updateConfig(options: configType) {
		const newConfig = {...this.config, ...options}
		this.config = newConfig
		// pass updates to DiceWorld
		this.#DiceWorld?.updateConfig(newConfig)
		// pass updates to PhysicsWorld
		this.#DiceWorker?.postMessage({
			action: 'updateConfig',
			options: newConfig
		})

		// make this method chainable
		return this
	}

	async loadTheme(){
		if(this.themeData.includes(this.config.theme)){
			return
		} else {
			this.#DiceWorld?.loadTheme(this.config.theme)
			this.themeData.push(this.config.theme)
		}
	}

	clear() {
		// reset indexes and rollData
		this.#rollIndex = 0
		this.#groupIndex = 0
		this.#idIndex = 0
		this.rollData = []
		// clear all rendered die bodies
		this.#DiceWorld?.clear()
    // clear all physics die bodies
    this.#DiceWorker?.postMessage({action: "clearDice"})

		// make this method chainable
		return this
  }

	hide() {
		this.canvas.style.display = 'none'
		return this
	}

	show() {
		this.canvas.style.display = 'block'
		return this
	}

	// add a die to another group. groupId should be included
  add( notation: inputTypes, groupId: groupIdType,  theme?: string ) {
		if ( theme ) this.config.theme = theme

		const parsedNotation = createNotationArray( notation )
		this.#makeRoll(parsedNotation, groupId)

		// make this method chainable
		return this
  }

	reroll( roll: rollType | rollType[] ) {
    const rollArray = Array.isArray(roll) ? roll : [roll]
    const groupId = rollArray[0].groupId
		
    rollArray.forEach(r =>  this.remove( r ) )

    const addQty = rollArray.map(r => ( {...r, qty: 1} ) )
    this.add(addQty, groupId)

		// make this method chainable
		return this
	}

	remove( roll: rollType ) {
		const { groupId, rollId } = roll
		// this will remove a roll from workers and rolldata
		// delete the roll from cache

    const rolls = this.rollData[groupId].rolls
    const filtered = rolls.filter(roll => roll.rollId !== rollId)

	  this.rollData[groupId].rolls = filtered

		// remove the die from the render
		this.#DiceWorld?.remove( roll )
		// Remove the die from the physics bodies.
    // We do this in case there's a reroll.
    // Don't want new dice interacting with a hidden physics body
		this.#DiceWorker?.postMessage({action: "removeDie", id: rollId})

		// make this method chainable
		return this
	}

  roll( notation: inputTypes, theme: string ) {
		// to add to a roll on screen use .add method
    // reset the offscreen worker and physics worker with each new roll
    this.clear()

		if( theme ) {
			this.config.theme = theme
		}

		let parsedNotation = createNotationArray( notation )
		this.#makeRoll( parsedNotation )

		// make this method chainable
		return this
  }

	// used by both .add and .roll - .roll clears the box and .add does not
	async #makeRoll(
    parsedNotation: parsedNotationType[], 
    groupId: groupIdType | undefined = undefined
  ){
		const hasGroupId = groupId !== undefined

		// load the theme prior to adding all the dice => give textures a chance to load so you don't see a flash of naked dice
		await this.loadTheme()

		// loop through the number of dice in the group and roll each one
		parsedNotation.forEach(notation => {
			const rolls = []

			for (var i = 0, len = notation.qty; i < len; i++) {
				// id's start at zero and zero can be falsy, so we check for undefined
				const rollId = notation.rollId !== undefined ? notation.rollId : this.#rollIndex++
				const id = notation.id !== undefined ? notation.id : this.#idIndex++

				const index = hasGroupId ? groupId : this.#groupIndex

				const roll = {
          rollId,
					id,
					sides: notation.sides,
					groupId: index,
					theme: this.config.theme
				}

				rolls[rollId] = roll

				this.#DiceWorld?.add( roll )
			}

			if ( hasGroupId ) {
				Object.assign( this.rollData[groupId].rolls, rolls )
			} else {
        const index = this.#groupIndex

				// save this roll group for later
				const addResult = rolls.map(roll => ( { ...roll, result: 0 } ) )
        const rollGroup = { ...notation, rolls: addResult, value: 0, modifier: 0 }

				//RollData expects modifier & value to be on the object.
				this.rollData[index] = rollGroup
				++this.#groupIndex
			}
		})
	}

	getRollResults(){
		// calculate the value of all the rolls added together
    // advanced rolls such as 4d6dl1 (4d6 drop lowest 1) will require an external parser
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