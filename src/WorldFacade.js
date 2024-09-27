import { createCanvas } from './components/world/canvas'
import physicsWorker from './components/physics.worker.js?worker&inline'
import { debounce, createAsyncQueue, Random, hexToRGB, webgl_support } from './helpers'

const defaultOptions = {
	id: `dice-canvas-${Date.now()}`, // set the canvas id
	container: null,
  enableShadows: true, // do dice cast shadows onto DiceBox mesh?
	shadowTransparency: .8,
	lightIntensity: 1,
  delay: 10, // delay between dice being generated - 0 causes stuttering and physics popping
	scale: 5, // scale the dice
	theme: 'default', // can be a hex color or a pre-defined theme such as 'purpleRock'
	preloadThemes: [],
	externalThemes: {}, // point to CDN paths
	themeColor: '#2e8555', // used for color values or named theme variants - not fully implemented yet // green: #2e8555 // yellow: #feea03
	offscreen: true, // use offscreen canvas browser feature for performance improvements - will fallback to false based on feature detection
	assetPath: '/assets/dice-box/', // path to 'ammo', 'themes' folders and web workers
	// origin: location.origin,
	origin: typeof window !== "undefined" ? window.location.origin : "",
	suspendSimulation: false
}

class WorldFacade {
	rollCollectionData = {}
	rollGroupData = {}
	rollDiceData = {}
	themeData = []
	themesLoadedData = {}
	#collectionIndex = 0
	#groupIndex = 0
	#rollIndex = 0
	#idIndex = 0
	#DiceWorld = {}
	#diceWorldPromise
	#diceWorldResolve
	#DicePhysics
	#dicePhysicsPromise
	#dicePhysicsResolve
	#webgl_support = true
	noop = () => {}

  constructor(options = {}){
		// allow for depricated config with a warning
		if (arguments.length === 2 && typeof(arguments[0] === 'string') && typeof(arguments[1] === 'object')) {
			console.warn(`You are using the old API. Dicebox constructor accepts a config object as it's only argument. Please read the v1.1.0 docs at https://fantasticdice.games/docs/usage/config`)
			options = arguments[1]
			options.container = arguments[0]
		}

		if(typeof options !== 'object') {
			throw new Error('Config options should be an object. Config reference: https://fantasticdice.games/docs/usage/config#configuration-options')
		}
		// pull out callback functions from options
		const { onCollision, onBeforeRoll, onDieComplete, onRollComplete, onRemoveComplete, onThemeConfigLoaded, onThemeLoaded, ...boxOptions } = options

		// extend defaults with options
		this.config = {...defaultOptions, ...boxOptions}

		// assign callback functions
		this.onBeforeRoll = options.onBeforeRoll || this.noop
		this.onDieComplete = options.onDieComplete || this.noop
		this.onRollComplete = options.onRollComplete || this.noop
		this.onRemoveComplete = options.onRemoveComplete || this.noop
		this.onThemeLoaded = options.onThemeLoaded || this.noop
		this.onThemeConfigLoaded = options.onThemeConfigLoaded || this.noop
		this.onCollision = options.onCollision || this.noop; // Add the new collision callback


		// is webGL supported?
		if(webgl_support()){
			// if a canvas selector is provided then that will be used for the dicebox, otherwise a canvas will be created using the config.id
			this.canvas = createCanvas({
				selector: this.config.container,
				id: this.config.id
			})
			this.isVisible = true
		} else {
			this.#webgl_support = false
		}

		// create a queue to prevent theme being loaded multiple times
		this.loadThemeQueue = createAsyncQueue()
  }

	// Load the BabylonJS World
	async #loadWorld(){

		// set up a promise to be fulfilled when a message comes back from DiceWorld indicating init is complete
		this.#diceWorldPromise = new Promise((resolve, reject) => {
			this.#diceWorldResolve = resolve
		})

		// resolve the promise one onInitComplete callback is triggered
		const onInitComplete = () => {
			this.#diceWorldResolve()
		}

    if(!this.#webgl_support){
      console.warn('This browser does not support WebGL which is required for 3D rendering. Falling back to random number generator')
      const WorldNone = await import('./components/world.none').then(module => module.default)
      this.#DiceWorld = new WorldNone({
				canvas: this.canvas,
				options: this.config,
				onInitComplete
			})
    }
		else if ("OffscreenCanvas" in window && "transferControlToOffscreen" in this.canvas && this.config.offscreen) {
			// Ok to use offscreen canvas - transfer control offscreen
			const WorldOffscreen = await import('./components/world.offscreen').then(module => module.default)
			// WorldOffscreen is just a container class that passes all method calls to the Offscreen Canvas worker
			this.#DiceWorld = new WorldOffscreen({
				canvas: this.canvas,
				options: this.config,
				onInitComplete
			})
		} else {
			if(this.config.offscreen){
				console.warn("This browser does not support OffscreenCanvas. Using standard canvas fallback.")
				this.config.offscreen = false
			}
			// code splitting out WorldOnscreen. It's essentially the same as offscreenCanvas.worker.js but communicates with the main thread differently
			const WorldOnscreen = await import('./components/world.onscreen').then(module => module.default)
			this.#DiceWorld = new WorldOnscreen({
				canvas: this.canvas,
				options: this.config,
				onInitComplete
			})
		}
	}

	// Load the AmmoJS physics world
	#loadPhysics(){
		// initialize physics world in which AmmoJS runs
		this.#DicePhysics = new physicsWorker()
		// set up a promise to be fulfilled when a message comes back from physics.worker indicating init is complete
		this.#dicePhysicsPromise = new Promise((resolve, reject) => {
			this.#dicePhysicsResolve = resolve
		})
		this.#DicePhysics.onmessage = (e) => {
			switch( e.data.action ) {
				case "init-complete":
					this.#dicePhysicsResolve(); // fulfill promise so other things can run
					break;
				case "collision": // Handle collision events from the worker
                    if (this.onCollision) {
                        this.onCollision(e.data.body0Id, e.data.body1Id, e.data.force);
                    }
                    break;
			}
    }
		// initialize the AmmoJS physics worker
		this.#DicePhysics.postMessage({
			action: "init",
			width: this.canvas.clientWidth,
			height: this.canvas.clientHeight,
			options: this.config
		})
	}

	#connectWorld(){
		const channel = new MessageChannel()
		
		// create message channel for the visual world and the physics world to communicate through
		this.#DiceWorld.connect(channel.port1)

		// create message channel for this WorldFacade class to communicate with physics world
		this.#DicePhysics.postMessage({
			action: "connect"
		},[ channel.port2 ])
	}

	resizeWorld(){
		// send resize events to workers - debounced for performance
		const resizeWorkers = () => {
			this.#DiceWorld.resize({width: this.canvas.clientWidth, height: this.canvas.clientHeight})
			if(this.#DicePhysics){
				this.#DicePhysics.postMessage({action: "resize", width: this.canvas.clientWidth, height: this.canvas.clientHeight});
			}
		}
		const debounceResize = debounce(resizeWorkers)
		window.addEventListener("resize", debounceResize)
	}

  async init() {
		// trigger physics first so it can load in parallel with world
    if(this.#webgl_support){
      this.#loadPhysics()
    } else {
      this.#dicePhysicsPromise = Promise.resolve()
    }
		await this.#loadWorld()
		this.resizeWorld()

		// now that DiceWorld is ready we can attach our callbacks
		this.#DiceWorld.onRollResult = (result) => {
			const die = this.rollDiceData[result.rollId]
			const group = this.rollGroupData[die.groupId]
			const collection = this.rollCollectionData[die.collectionId]

			// map die results back to our rollData
			// since all rolls are references to this.rollDiceDate the values will be added to those objects
			group.rolls[die.rollId].value = result.value

			// increment the completed roll count for this group
			collection.completedRolls++
			// if all rolls are completed then resolve the collection promise - returning dice that were in this collection
			if(collection.completedRolls == collection.rolls.length) {
				// pull out roll.collectionId and roll.id? They're meant to be internal values
				collection.resolve(Object.values(collection.rolls).map(({collectionId, id, meshName, ...rest}) => rest))
			}

			// trigger callback passing individual die result
			const {collectionId, id, ...returnDie} = die
			this.onDieComplete(returnDie)
		}
		this.#DiceWorld.onRollComplete = () => {
			// trigger callback passing the roll results
			this.onRollComplete(this.getRollResults())
		}

		this.#DiceWorld.onDieRemoved = (rollId) => {
			// get die information from cache
			let die = this.rollDiceData[rollId]
			const collection = this.rollCollectionData[die.removeCollectionId]
			collection.completedRolls++

			// remove this die from cache
			delete this.rollDiceData[die.rollId]

			// remove this die from it's group rolls
			const group = this.rollGroupData[die.groupId]
			delete group.rolls[die.rollId]

			// parse the group value now that the die has been removed from data
			const groupData = this.#parseGroup(die.groupId)
			// update the value and quantity values
			group.value = groupData.value
			group.qty = groupData.rollsArray.length

			// if all rolls are completed then resolve the collection promise - returning dice that were removed
			if(collection.completedRolls == collection.rolls.length) {
				collection.resolve(Object.values(collection.rolls).map(({id, ...rest}) => rest))
			}
			const {collectionId, id, removeCollectionId, meshName, ...returnDie} = die
			this.onRemoveComplete(returnDie)
		}

    // wait for both DiceWorld and DicePhysics to initialize
		await Promise.all([this.#diceWorldPromise, this.#dicePhysicsPromise])
    
    if(this.#DicePhysics){
      // set up message channels between Dice World and Dice Physics
      this.#connectWorld()
    }

		// queue load of the theme defined in the config
		await this.loadThemeQueue.push(() => this.loadTheme(this.config.theme))
		
		// queue load of other defined themes

		this.config.preloadThemes.forEach(async function(theme) {
			await this.loadThemeQueue.push(() => this.loadTheme(theme))
		}.bind(this))


		//TODO: this should probably return a promise
		// make this method chainable
		return this
  }

	// fetch the theme config and return a themeData object
	async getThemeConfig(theme){
		let basePath = `${this.config.origin}${this.config.assetPath}themes/${theme}`

		if(this.config.externalThemes[theme]){
			basePath = this.config.externalThemes[theme]
		}


		// fetch the theme.config file
		let themeData = await fetch(`${basePath}/theme.config.json`).then(resp => {
			if(resp.ok) {
				const contentType = resp.headers.get("content-type")
				if (contentType && contentType.indexOf("application/json") !== -1) {
					return resp.json()
				} 
				else if (resp.type && resp.type === 'basic') {
					return resp.json()
				}
				else {
					// return resp
					throw new Error(`Incorrect contentType: ${contentType}. Expected "application/json" or "basic"`)
				}
			} else {
				throw new Error(`Unable to fetch config file for theme: '${theme}'. Request rejected with status ${resp.status}: ${resp.statusText}`)
			}
		}).catch(error => console.error(error))

		if(!themeData){
			throw new Error("No theme config data to work with.")
		}

		let meshName = 'default'
		let meshFilePath = `${this.config.origin}${this.config.assetPath}themes/default/default.json`

		if(themeData.hasOwnProperty('meshFile')){
			meshName = themeData.meshFile.replace(/(.*)\..{2,4}$/,'$1')
			meshFilePath = `${basePath}/${themeData.meshFile}`
		}

		// if diceAvailable is not specified then assume the default set of seven
		if(!themeData.hasOwnProperty('diceAvailable')){
			throw new Error('A theme must indicate which dice are available by defining "diceAvailable".')
		}

		// extend themes
		// if a theme extends another theme then the diceAvailable will be added to the diceExtended value of the extended theme
		// the extended them can then roll those dice as if it were part of it's own theme
		// example: diceOfRolling-fate extends diceOfRolling. You can now roll 3dfate with the theme: 'diceOfRolling'

		if(themeData.hasOwnProperty("extends")){
			const target = await this.loadTheme(themeData.extends).catch(error => console.error(error))

			// can not extend a theme that extends another theme
			if(target.hasOwnProperty("extends")){
				throw new Error('Cannot extend a theme that extends another theme.')
			}

			// add target diceAvailable into theme.diceExtended
			const newDice = {}
			themeData.diceAvailable.forEach(die => {
				newDice[die] = themeData.systemName
			})
			target.diceExtended = {...target.diceExtended, ...newDice}
			// set the theme to the parent theme
			this.config.theme = themeData.extends
		}


		Object.assign(themeData,
			{
				basePath,
				meshFilePath,
				meshName,
				theme,
			}
		)

		// this.onThemeConfigLoaded(themeData)

		return themeData
	}

	async loadTheme(theme){
		// check the cache
		if(this.themesLoadedData[theme]) {
			// short circuit if theme has been previously loaded
			// console.log(`${theme} has already been loaded. Returning cache`)
			return this.themesLoadedData[theme]
		}
		// console.log(`${theme} is loading ...`)

		// fetch and save the themeData for later
		const themeConfig = this.themesLoadedData[theme] = await this.getThemeConfig(theme).catch(error => console.error(error))
		this.onThemeConfigLoaded(themeConfig)

		if(!themeConfig) return

		// pass config onto DiceWorld to load - the theme loader needs 'scene' from DiceWorld
		await this.#DiceWorld.loadTheme(themeConfig).catch(error => console.error(error))

		this.onThemeLoaded(themeConfig)

		return themeConfig
	}

	// TODO: use getter and setter
	// change config options
	async updateConfig(options) {
		const newConfig = {...this.config,...options}
		// console.log('newConfig', newConfig)
		// const config = await this.loadThemeQueue.push(() => this.loadTheme(newConfig.theme))
		// const themeData = config.at(-1) //get the last entry returned from the queue

		this.config = newConfig

		if(newConfig.theme){
			const config = await this.loadThemeQueue.push(() => this.loadTheme(newConfig.theme))
			const themeData = config.at(-1) //get the last entry returned from the queue
			if(themeData.hasOwnProperty("extends")){
				// set the theme to the parent theme
				this.config.theme = themeData.extends
			}
		}

		// pass updates to DiceWorld
		this.#DiceWorld.updateConfig(newConfig)

		if(this.#DicePhysics){
		// pass updates to PhysicsWorld
			this.#DicePhysics.postMessage({
				action: 'updateConfig',
				options: newConfig
			})
		}

		// make this method chainable
		return this
	}

	clear() {
		// reset indexes
		this.#collectionIndex = 0
		this.#groupIndex = 0
		this.#rollIndex = 0
		this.#idIndex = 0
		// reset internal data objects
		this.rollCollectionData = {}
		this.rollGroupData = {}
		this.rollDiceData = {}
		// clear all rendered die bodies
		this.#DiceWorld.clear()
		if(this.#DicePhysics){
			// clear all physics die bodies
			this.#DicePhysics.postMessage({action: "clearDice"})
		}

		// make this method chainable
		return this
  }

	hide(className) {
		if(className){
			this.canvas.dataset.hideClass = className
			this.canvas.classList.add(className)
		} else {
			this.canvas.style.display = 'none'
		}

		this.isVisible = false;

		// make this method chainable
		return this
	}

	show() {
		const hideClass = this.canvas.dataset?.hideClass
		if(hideClass){
			delete this.canvas.dataset.hideClass
			this.canvas.classList.remove(hideClass)
		} else {
			this.canvas.style.display = 'block'
		}
		this.isVisible = true;
		this.resizeWorld();

		// make this method chainable
		return this
	}

	// TODO: pass data with roll - such as roll name. Passed back at the end in the results
	roll(notation, {theme = this.config.theme, themeColor = this.config.themeColor, newStartPoint = true} = {}) {
		// note: to add to a roll on screen use .add method
		// reset the offscreen worker and physics worker with each new roll
		this.clear()
		const collectionId = this.#collectionIndex++
		
		this.rollCollectionData[collectionId] = new Collection({
			id: collectionId,
			notation,
			theme,
			themeColor,
			newStartPoint
		})

		const parsedNotation = this.createNotationArray(notation, this.themesLoadedData[theme].diceAvailable)
		this.#makeRoll(parsedNotation, collectionId)

		// returns a Promise that is resolved in onRollComplete
		return this.rollCollectionData[collectionId].promise
	}

  add(notation, {theme = this.config.theme, themeColor = this.config.themeColor, newStartPoint = true} = {}) {

		const collectionId = this.#collectionIndex++

		this.rollCollectionData[collectionId] = new Collection({
			id: collectionId,
			notation,
			theme,
			themeColor,
			newStartPoint
		})
		
		const parsedNotation = this.createNotationArray(notation, this.themesLoadedData[theme].diceAvailable)
		this.#makeRoll(parsedNotation, collectionId)

		// returns a Promise that is resolved in onRollComplete
		return this.rollCollectionData[collectionId].promise
  }

	reroll(notation, {remove = false, hide = false, newStartPoint = true} = {}) {
		// TODO: add hide if you want to keep the die result for an external parser

		// ensure notation is an array
		const rollArray = Array.isArray(notation) ? notation : [notation]

		// destructure out 'sides', 'theme', 'groupId', 'rollId' - basically just getting rid of value - could do ({value, ...rest}) => rest
		const cleanNotation = rollArray.map(({value, ...rest}) => rest)

		if(remove === true){
			this.remove(cleanNotation, {hide})
		}

		// .add will return a promise that will then be returned here
		return this.add(cleanNotation, {newStartPoint})
	}

	remove(notation, {hide = false} = {}) {
		// ensure notation is an array
		const rollArray = Array.isArray(notation) ? notation : [notation]

		const collectionId = this.#collectionIndex++

		this.rollCollectionData[collectionId] = new Collection({
			id: collectionId,
			notation,
			rolls: rollArray,
		})

		// loop through each die to be removed
		rollArray.map(die => {
			// add the collectionId to the die so it can be looked up in the callback
			this.rollDiceData[die.rollId].removeCollectionId = collectionId
			// assign the id for this die from our cache - required for removal
			// die.id = this.rollDiceData[die.rollId].id - note: can appear in async roll result data if attached to die object
			let id = this.rollDiceData[die.rollId].id
			// remove the die from the render - don't like having to pass two ids. rollId is passed over just so it can be passed back for callback
			this.#DiceWorld.remove({id,rollId: die.rollId})
			if(this.#DicePhysics){
				// remove the die from the physics bodies
				this.#DicePhysics.postMessage({action: "removeDie", id })
			}
		})

		return this.rollCollectionData[collectionId].promise
	}

	// used by both .add and .roll - .roll clears the box and .add does not
	async #makeRoll(parsedNotation, collectionId){

		this.onBeforeRoll(parsedNotation)

		const collection = this.rollCollectionData[collectionId]
		let newStartPoint = collection.newStartPoint

		// loop through the number of dice in the group and roll each one
		parsedNotation.forEach(async notation => {
			if(!notation.sides) {
				throw new Error("Improper dice notation or unable to parse notation")
			}
			let theme = notation.theme || collection.theme || this.config.theme
			const themeColor = notation.themeColor || collection.themeColor || this.config.themeColor
			const rolls = {}
			const hasGroupId = notation.groupId !== undefined
			let index
			
			// load the theme, will be short circuited if previously loaded
			const loadTheme = () => this.loadTheme(theme)
			await this.loadThemeQueue.push(loadTheme)

			// const {meshName, diceAvailable, diceInherited = {}, material: { type: materialType }} = this.themesLoadedData[theme]
			let meshName = this.themesLoadedData[theme].meshName
			let diceAvailable = this.themesLoadedData[theme]?.diceAvailable
			let diceExtended = this.themesLoadedData[theme].diceExtended || {}
			let materialType = this.themesLoadedData[theme]?.material?.type

			const diceExtra = Object.keys(diceExtended)

			if(diceExtra && diceExtra.includes(notation.sides)){
				theme = diceExtended[notation.sides]
				const loadExtendedTheme = () => this.loadTheme(theme)
				this.loadThemeQueue.push(loadExtendedTheme)
				meshName = this.themesLoadedData[theme].meshName
				diceAvailable = this.themesLoadedData[theme]?.diceAvailable
				materialType = this.themesLoadedData[theme]?.material?.type
			}

			let colorSuffix = '', color

			if(materialType === "color") {
				color = hexToRGB(themeColor)
				// dat.gui uses HSB(a.k.a HSV) brightness greater than .5 and saturation less than .5
				colorSuffix = ((color.r*0.299 + color.g*0.587 + color.b*0.114) > 175) ? '_dark' : '_light'
			}

			// TODO: should I validate that added dice are only joining groups of the same "sides" value - e.g.: d6's can only be added to groups when sides: 6? Probably.
			for (var i = 0, len = notation.qty; i < len; i++) {
				// id's start at zero and zero can be falsy, so we check for undefined
				let rollId = notation.rollId !== undefined ? notation.rollId : this.#rollIndex++
				let id = notation.id !== undefined ? notation.id : this.#idIndex++
				index = hasGroupId ? notation.groupId : this.#groupIndex

        // when a roll object is passed in, notation.sides could be an integer - convert the die type to include the "d" prefix so it will match the model names
				const dieType = Number.isInteger(notation.sides) ? `d${notation.sides}` : notation.sides

        // when a roll string is passed in, notation.sides will be a string - convert it to an integer so it will match the object data type of a notation object
        if(/^d[1-9]{1}[0-9]{0,1}0?$/.test(notation.sides)){
          notation.sides =  parseInt(notation.sides.replace('d', ''))
        }

				const roll = {
					sides: notation.sides,
					data: notation.data,
					dieType,
					groupId: index,
					collectionId: collection.id,
					rollId,
					id,
					theme,
					themeColor,
					meshName
				}

				rolls[rollId] = roll
				this.rollDiceData[rollId] = roll
				collection.rolls.push(this.rollDiceData[rollId])

				// TODO: eliminate the 'd' for more flexible naming such as 'fate' - ensure numbers are strings
				if (roll.sides === 'fate' && (!diceAvailable.includes(dieType) && !diceExtra.includes(dieType)) || roll.sides === 'fate' && !this.#webgl_support){
					console.warn(`fate die unavailable in '${theme}' theme. Using fallback.`)
					const min = -1
					const max = 1
					roll.value = Random.range(min,max)
					this.#DiceWorld.addNonDie(roll)
				} else if(this.config.suspendSimulation || (!diceAvailable.includes(dieType) && !diceExtra.includes(dieType)) || !this.#webgl_support){
					// check if the requested roll is available in the current theme, if not then use crypto fallback
					const warning = 
					!this.#webgl_support 
						? `This browser does not support webGL. Using random number fallback.` 
						: this.config.suspendSimulation 
							? "3D simulation suspended. Using fallback." 
							: `${roll.sides} die unavailable in '${theme}' theme. Using fallback.`
					console.warn(warning)
					const max = Number.isInteger(roll.sides) ? roll.sides : parseInt(roll.sides.replace(/\D/g,''))
					roll.value = Random.range(1, max)
					this.#DiceWorld.addNonDie(roll)
				} else {
					let extendedTheme
					if(diceExtra.includes(dieType)) {
						const extendedThemeName = diceExtended[dieType]
						extendedTheme = this.themesLoadedData[extendedThemeName]
					}
					this.#DiceWorld.add({
						...roll,
						newStartPoint,
						theme: extendedTheme?.systemName || theme,
						meshName: extendedTheme?.meshName || meshName,
						colorSuffix
					})
				}

				// turn flag off
				newStartPoint = false
			}

			if(hasGroupId) {
				Object.assign(this.rollGroupData[index].rolls, rolls)
			} else {
				// save this roll group for later
				notation.rolls = rolls
				notation.id = index
				this.rollGroupData[index] = notation
				++this.#groupIndex
			}
		})
	}

	// accepts simple notations eg: 4d6
	// accepts array of notations eg: ['4d6','2d10']
	// accepts object {sides:int, qty:int}
	// accepts array of objects eg: [{sides:int, qty:int, mods:[]}]
	createNotationArray(input, diceAvailable){
		const notation = Array.isArray( input ) ? input : [ input ]
		let parsedNotation = []


		const verifyObject = ( object ) => {
			if(!object.hasOwnProperty('qty')) {
				object.qty = 1
			}
			if ( object.hasOwnProperty('sides') ) {
				if(object.sides === '100'){
					object.sides = 100
					object.data = 'single'
				}
				return true
			} else {
				const err = "Roll notation is missing sides"
				throw new Error(err);
			}
		}

		const incrementId = (key) => {
			key = key.toString()
			let splitKey = key.split(".")
			if(splitKey[1]){
				splitKey[1] = parseInt(splitKey[1]) + 1
			} else {
				splitKey[1] = 1
			}
			return splitKey[0] + "." + splitKey[1]
		}

		// verify that the rollId is unique. If not then increment it by .1
		// rollIds become keys in the rollDiceData object, so they must be unique or they will overwrite another entry
		const verifyRollId = ( object ) => {
			if(object.hasOwnProperty('rollId')){
				if(this.rollDiceData.hasOwnProperty(object.rollId)){
					object.rollId = incrementId(object.rollId)
				}
			}
			if(!object.hasOwnProperty('modifier')){
				object.modifier = 0
			}
		}

		// notation is an array of strings or objects
		notation.forEach(roll => {
			// console.log('roll', roll)
			// if notation is an array of strings
			if ( typeof roll === 'string' ) {
				parsedNotation.push( this.parse( roll, diceAvailable ) )
			} else if ( typeof notation === 'object' ) {
				verifyRollId( roll )
				verifyObject( roll )  && parsedNotation.push( roll )
			}
		})

		return parsedNotation
	}

  // parse text die notation such as 2d10+3 => {number:2, type:6, modifier:3}
  // taken from https://github.com/ChapelR/dice-notation
  parse(notation, diceAvailable) {
    const diceNotation = /(\d+)([dD]{1}\d+)(.*)$/i
		const percentNotation = /(\d+)[dD](00|%)(.*)$/i
		const fudgeNotation = /(\d+)[dD](f+[ate]*)(.*)$/i
		// const customNotation = /(\d+)[dD](.*)([+-])/i
		const customNotation = /(\d+)[dD]([\d\w]+)([+-]{0,1}\d+)?/i
    const modifier = /([+-])(\d+)/
    const cleanNotation = notation.trim().replace(/\s+/g, '')
    const validNumber = (n, err) => {
      n = Number(n)
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) {
        throw new Error(err);
      }
      return n
    }

		// match percentNotation before diceNotation
    const roll = cleanNotation.match(percentNotation) || cleanNotation.match(diceNotation) || cleanNotation.match(fudgeNotation) || cleanNotation.match(customNotation);

		let mod = 0;
    const msg = 'Invalid notation: ' + notation + '';

    if (!roll || !roll.length || roll.length < 3) {
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

		const returnObj = {
			qty : validNumber(roll[1], msg),
      modifier: mod,
		}

		if(cleanNotation.match(percentNotation)){
			returnObj.sides = 'd100'
			returnObj.data = 'single'
		} else if(cleanNotation.match(fudgeNotation)){
			returnObj.sides = 'fate' // force lowercase
		} else if(diceAvailable.includes(cleanNotation.match(customNotation)[2])){
			returnObj.sides = roll[2] // dice type instead of number
		} else {
			returnObj.sides = roll[2];
		}

    return returnObj
  }

	#parseGroup(groupId) {
		// console.log('groupId', groupId)
		const rollGroup = this.rollGroupData[groupId]
		// turn object into an array
		const rollsArray = Object.values(rollGroup.rolls).map(({collectionId, id, meshName, ...rest}) => rest)
		// add up the values
		// some dice may still be rolling, should this be a promise?
		// if dice are still rolling in the group then the value is undefined - hence the isNaN check
		let value = rollsArray.reduce((val,roll) => {
			const rollVal = isNaN(roll.value) ? 0 : roll.value
			return val + rollVal
		},0)
		// add the modifier
		value += rollGroup.modifier ? rollGroup.modifier : 0
		// return the value and the rollsArray
		return {value, rollsArray}
	}

	getRollResults(){
		// loop through each roll group
		return Object.entries(this.rollGroupData).map(([key,val]) => {
			// parse the group data to get the value and the rolls as an array
			const groupData = this.#parseGroup(key)
			// set the value for this roll group in this.rollGroupData
			val.value = groupData.value
			// set the qty equal to the number of rolls - this can be changed by rerolls and removals
			val.qty = groupData.rollsArray.length
			// copy the group that will be put into the return object
			const groupCopy = {...val}
			// replace the rolls object with a rolls array
			groupCopy.rolls = groupData.rollsArray
			// return the groupCopy - note: we never return this.rollGroupData
			return groupCopy
		})
	}
}

class Collection{
	constructor(options){
		Object.assign(this,options)
		this.rolls = options.rolls || []
		this.completedRolls = 0
		const that = this
		this.promise = new Promise((resolve,reject) => {
			that.resolve = resolve
			that.reject = reject
		})
	}
}

export default WorldFacade