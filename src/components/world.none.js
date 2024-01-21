import Dice from './Dice'
class WorldNone {
	config
	#canvas
	initialized = false
	#dieCache = {}
	#count = 0
	#sleeperCount = 0
	#dieRollTimer = []
	#rollCompleteTimer
	noop = () => {}
	constructor(options){
		this.onInitComplete = options.onInitComplete || this.noop
		this.onThemeLoaded = options.onThemeLoaded || this.noop
		this.onRollResult = options.onRollResult || this.noop
		this.onRollComplete = options.onRollComplete || this.noop
		this.onDieRemoved = options.onDieRemoved || this.noop
		this.initialized = this.initScene(options)
	}

	async initScene(config) {
		// set the config from World
		this.config = config.options

		// init complete - let the world know
		this.onInitComplete()
	}

	resize(){
		
	}

	loadTheme(){
		return Promise.resolve()
	}

	updateConfig(options){
		Object.assign(this.config, options)
	}

	addNonDie(die){
		console.log('die', die)
		clearTimeout(this.#rollCompleteTimer)
		const {id, value, ...rest} = die
		const newDie = {
			id,
			value,
			config: rest
		}
		this.#dieCache[id] = newDie
		
		this.#dieRollTimer.push(setTimeout(() => {
			this.handleAsleep(newDie)
		}, this.#count++ * this.config.delay))

		// since we don't have a render loop, we'll set an internal timer
		this.#rollCompleteTimer = setTimeout(() => {
			this.onRollComplete()
		}, 500)
	}

	add(die){
		console.log("add die")
		this.addNonDie(die)
	}

	remove(data){
		console.log("remove die")
		// TODO: test this with exploding dice
		const dieData = this.#dieCache[data.id]
		
		// check if this is d100 and remove associated d10 first
		if(dieData.hasOwnProperty('d10Instance')){
			// delete entry
			delete this.#dieCache[dieData.d10Instance.id]
			// decrement count
			this.#sleeperCount--
		}

		// delete entry
		delete this.#dieCache[data.id]
		// decrement count
		this.#sleeperCount--

		this.onDieRemoved(data.rollId)
	}

	clear(){
		if(!Object.keys(this.#dieCache).length && !this.#sleeperCount) {
			return
		}

		this.#dieRollTimer.forEach(timer=>clearTimeout(timer))

		// remove all dice
		Object.values(this.#dieCache).forEach(die => {
			if(die.mesh)
				die.mesh.dispose()
		})
		
		// reset storage
		this.#dieCache = {}
		this.#count = 0
		this.#sleeperCount = 0
	}

	// handle the position updates from the physics worker. It's a simple flat array of numbers for quick and easy transfer
	async handleAsleep(die){
		// mark this die as asleep
		die.asleep = true
	
		// get the roll result for this die
		await Dice.getRollResult(die)
	
		if(die.d10Instance || die.dieParent) {
			// if one of the pair is asleep and the other isn't then it falls through without getting the roll result
			// otherwise both dice in the d100 are asleep and ready to calc their roll result
			if(die?.d10Instance?.asleep || die?.dieParent?.asleep) {
				const d100 = die.config.sides === 100 ? die : die.dieParent
				const d10 = die.config.sides === 10 ? die : die.d10Instance
				if (d10.value === 0 && d100.value === 0) {
					d100.value = 100; // 00 + 0 is 100 on a d100
				} else {
					d100.value = d100.value + d10.value
				}
	
				this.onRollResult({
					rollId: d100.config.rollId,
					value : d100.value
				})
			}
		} else {
			// turn 0's on a d10 into a 10
			if(die.config.sides === 10 && die.value === 0) {
				die.value = 10
			}
			this.onRollResult({
				rollId: die.config.rollId,
				value: die.value
			})
		}
		// add to the sleeper count
		this.#sleeperCount++
	}
}

export default WorldNone