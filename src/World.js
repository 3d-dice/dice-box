import { createCanvas } from './components/canvas'
import WorldOnscreen from './components/world.onscreen'
import WorldOffscreen from './components/world.offscreen'
import physicsWorker from './components/physics.worker?worker'
import { debounce } from './helpers'

// private variables
let canvas, DiceWorld, DiceWorldInit, diceWorker, diceWorkerInit, groupIndex = 0, rollIndex = 0, idIndex = 0


const defaultOptions = {
	id: 'dice-canvas',
  enableShadows: true,
  delay: 10,
	gravity: 3, //TODO: high gravity will cause dice piles to jiggle
	startingHeight: 15,
	spinForce: 20,
	throwForce: 2.5,
	zoomLevel: 3, // 0-7, can we round it out to 9? And reverse it because higher zoom means closer
	theme: 'nebula',
	offscreen: true,
}

class World {
  constructor(container, options = {}){
		this.config = {...defaultOptions, ...options}
    canvas = createCanvas({
      selector: container,
      id: this.config.id
    })
		this.rollData = []
		this.onDieComplete = () => {}
		this.onRollComplete = () => {}

		if ("OffscreenCanvas" in window && "transferControlToOffscreen" in canvas && this.config.offscreen) { 
			// Ok to use offscreen canvas
			// transfer controll offscreen
			DiceWorld = new WorldOffscreen({
				canvas,
				options: {...this.config, ...options}
			})
		} else {
			if(this.config.offscreen){
				console.warn("This browser does not support OffscreenCanvas. Using standard canvas fallback.")
				this.config.offscreen = false
			}
			DiceWorld = new WorldOnscreen({
				canvas,
				options: {...this.config, ...options}
			})
		}

		DiceWorld.init = new Promise((resolve, reject) => {
      DiceWorldInit = resolve
    })

		// create message channels for the two web workers to communicate through
		const channel = new MessageChannel()
		DiceWorld.connect(channel.port1)

		// initialize physics world in which AmmoJS runs
    diceWorker = new physicsWorker()
    diceWorker.init = new Promise((resolve, reject) => {
      diceWorkerInit = resolve
    })

    // Setup the connection: Port 2 is for diceWorker
    diceWorker.postMessage({
      action: "connect",
    },[ channel.port2 ])

    // send resize events to workers - debounced for performance
		const resizeWorkers = () => {
			// canvas.width = data.width
			// canvas.height = data.height
			DiceWorld.resize({width: canvas.clientWidth, height: canvas.clientHeight})
      diceWorker.postMessage({action: "resize", width: canvas.clientWidth, height: canvas.clientHeight});
		}
		const debounceResize = debounce(resizeWorkers)
    window.addEventListener("resize", debounceResize)
  }

  async initScene(options = {}) {

		DiceWorld.onInitComplete = () => {
			DiceWorldInit()
		}
		DiceWorld.onRollResult = (die) => {
			// map die results back to our rollData
			this.rollData[die.groupId].rolls[die.rollId].result = die.result
			// TODO: die should have 'sides' or is that unnecessary data passed between workers?
			this.onDieComplete(die)
		}
		DiceWorld.onRollComplete = () => {
			this.rollData.forEach(rollGroup => {
				// convert rolls from indexed objects to array
				rollGroup.rolls = Object.values(rollGroup.rolls).map(roll => roll)
				// add up the values
				rollGroup.value = rollGroup.rolls.reduce((val,roll) => val + roll.result,0)
				// add the modifier
				rollGroup.value += rollGroup.modifier ? rollGroup.modifier : 0
			})
			this.onRollComplete(this.rollData)
		}

    // initialize the AmmoJS physics worker
    diceWorker.postMessage({
      action: "init",
      width: canvas.clientWidth,
      height: canvas.clientHeight,
			options: this.config
    })

    diceWorker.onmessage = (e) => {
			switch( e.data.action ) {
				case "init-complete":
					diceWorkerInit() // fulfill promise so other things can run
			}
    }

    // pomise.all to initialize both offscreenWorker and diceWorker
		// TODO: yikes. Going to have to async the onscreen class init as well
		await Promise.all([DiceWorld.init, diceWorker.init])

  }

	clear() {
		// reset indexes and rollData
		rollIndex = 0
		groupIndex = 0
		this.rollData = []
		// clear all rendered die bodies
		DiceWorld.clear()
    // clear all physics die bodies
    diceWorker.postMessage({action: "clearDice"})
		return this
  }

	hide() {
		canvas.style.display = 'none'
		return this
	}

	show() {
		canvas.style.display = 'block'
		return this
	}

	// add a die to another group. groupId should be included
  add(notation, groupId = 0, theme) {
		if(typeof groupId === 'string' || theme) {
			this.config.theme = theme
		}
		let parsedNotation = this.createNotationArray(notation)
		this.makeRoll(parsedNotation, groupId)
		return this
  }

	reroll(die) {
		// TODO: add hide if you want to keep the die result for an external parser
		// TODO: reroll group
		// TODO: reroll array
		this.remove(die)
		die.qty = 1
		this.add(die, die.groupId)
		return this
	}

	remove(die) {
		const {groupId, rollId, hide = false} = die
		// this will remove a roll from workers and rolldata
		// TODO: hide if you want to keep the die result for an external parser
		// delete the roll from cache
		delete this.rollData[groupId].rolls[rollId]
		// remove the die from the render
		DiceWorld.remove({groupId, rollId})
		// remove the die from the physics bodies - we do this in case there's a reroll. Don't want new dice interacting with a hidden physics body
		diceWorker.postMessage({action: "removeDie", id: rollId})
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
		this.makeRoll(parsedNotation)
		return this
  }

	makeRoll(parsedNotation, groupId){
		const hasGroupId = groupId !== undefined

		// loop through the number of dice in the group and roll each one
		parsedNotation.forEach(notation => {
			// console.log(`notation`, notation)
			const rolls = {}
			const index = hasGroupId ? groupId : groupIndex
			for (var i = 0, len = notation.qty; i < len; i++) {
				// id's start at zero and zero can be falsy, so we check for undefined
				let rollId = notation.rollId !== undefined ? notation.rollId : rollIndex++
				let id = notation.id !== undefined ? notation.id : idIndex++

				const roll = {
					sides: notation.sides,
					groupId: index,
					rollId,
					id,
					theme: this.config.theme
				}
	
				rolls[rollId] = roll

				DiceWorld.add(roll)
				
			}
	
			if(hasGroupId) {
				Object.assign(this.rollData[groupId].rolls, rolls)
			} else {
				// save this roll group for later
				notation.rolls = rolls
				this.rollData[index] = notation
				++groupIndex
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