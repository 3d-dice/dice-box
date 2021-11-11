import { createEngine } from './engine'
import { createScene } from './scene'
import { createCamera } from './camera'
import DiceBox from './DiceBox'
import { createLights } from './lights'
import Dice from './Dice'

class WorldOnscreen {
	config
	initialized = false
	#dieCache = []
	#sleeperCache = []
	#count = 0
	#dieRollTimer = []
	#canvas
	#engine
	#scene
	#camera
	#lights
	#diceBox
	#physicsWorkerPort
	onInitComplete = () => {}
	onRollResult = () => {}
	onRollComplete = () => {}

	constructor(options){
		this.initialized = this.initScene(options)
	}
	
	// initialize the babylon scene
	async initScene(config) {
		this.#canvas  = config.canvas
	
		// set the config from World
		this.config = config.options
	
		// setup babylonJS scene
		this.#engine  = createEngine(this.#canvas )
		this.#scene = createScene({engine:this.#engine })
		this.#camera  = createCamera({engine:this.#engine , zoomLevel:this.config.zoomLevel, scene: this.#scene})
		this.#lights  = createLights({enableShadows: this.config.enableShadows, scene: this.#scene})
	
		// create the box that provides surfaces for shadows to render on
		this.#diceBox  = new DiceBox({
			enableShadows: this.config.enableShadows,
			zoomLevel: this.config.zoomLevel,
			aspect: this.#canvas.width / this.#canvas.height,
			lights: this.#lights,
			scene: this.#scene
		})
		
		// loading all our dice models
		// we use to load these models individually as needed, but it's faster to load them all at once and prevents animation jank when rolling
		await Dice.loadModels({
			assetPath: this.config.assetPath,
			scene: this.#scene
		})
	
		// init complete - let the world know
		this.onInitComplete(true)

		// is this needed?
		// return true
	}

	connect(port){
		this.#physicsWorkerPort = port
		this.#physicsWorkerPort.onmessage = (e) => {
        switch (e.data.action) {
          case "updates": // dice status/position updates from physics worker
						this.updatesFromPhysics(e.data)
            break;
        
          default:
            console.error("action from physicsWorker not found in offscreen worker")
            break;
        }
      }
	}

	updateConfig(options){
		const prevConfig = this.config
		this.config = options
		// check if zoom level has changed
		if(prevConfig.zoomLevel !== this.config.zoomLevel){
			// redraw the DiceBox for shadows shader
			this.#diceBox.destroy()
			this.#diceBox  = new DiceBox({
				enableShadows: this.config.enableShadows,
				zoomLevel: this.config.zoomLevel,
				aspect: this.#canvas.width / this.#canvas.height,
				lights: this.#lights ,
				scene: this.#scene
			})
			// redraw the camera which changes position based on zoomLevel value
			this.#camera.dispose()
			this.#camera  = createCamera({engine:this.#engine , zoomLevel: this.config.zoomLevel})
		}
		// check if shadows setting has changed
		if(prevConfig.enableShadows !== this.config.enableShadows) {
			// regenerate the lights
			Object.values(this.#lights ).forEach(light => light.dispose())
			this.#lights  = createLights({enableShadows: this.config.enableShadows})
		}
	}

	// all this does is start the render engine.
	render() {
		// document.body.addEventListener('click',()=>engine.stopRenderLoop())
		this.#engine.runRenderLoop(this.renderLoop.bind(this))
		this.#physicsWorkerPort.postMessage({
			action: "resumeSimulation",
		})
	}

	renderLoop() {
		// if no dice are awake then stop the render loop and save some CPU power
		if(this.#sleeperCache.length !== 0 && this.#dieCache.length === 0) {
			// console.log(`no dice moving`)
			this.#engine.stopRenderLoop()

			// stop the physics engine
			this.#physicsWorkerPort.postMessage({
				action: "stopSimulation",
			})

			// trigger callback that roll is complete
			this.onRollComplete()
		}
		// otherwise keep on rendering
		else {
			this.#scene.render() // not the same as this.render()
		}
	}

	clear() {
		if(!this.#dieCache.length && !this.#sleeperCache.length) {
			return
		}
		this.#dieRollTimer.forEach(timer=>clearTimeout(timer))
		// stop anything that's currently rendering
		this.#engine.stopRenderLoop()
		// remove all dice
		this.#dieCache.forEach(die => die.mesh.dispose())
		this.#sleeperCache.forEach(die => die.mesh.dispose())
		this.#count = 0
	
		// step the animation forward
		this.#scene.render()
	
		// reset storage
		this.#dieCache = []
		this.#sleeperCache = []
	}

	add(options) {
		// space out adding the dice so they don't lump together too much
		
		// this.#dieRollTimer.push(setTimeout(() => {
		// 	this._add({...options},count)
		// }, this.#count++ * this.config.delay))
		const dieOptions = {
			...options,
			assetPath: this.config.assetPath,
			enableShadows: this.config.enableShadows,
			lights: this.#lights,
			scene: this.#scene
		}
		let count = this.#count
		console.log("await loadDie", count)
		this.#dieRollTimer.push(setTimeout(() => {
		Dice.loadDie(dieOptions).then(resp => {
				this._add({...resp},count)
			})
		}, this.#count++ * this.config.delay))
		console.log("die loaded", count)

	}

	// add a die to the scene
	async _add(options,count) {
		if(this.#engine.activeRenderLoops.length === 0) {
			this.render()
		}
		// const themes = ['galaxy','gemstone','glass','iron','nebula','sunrise','sunset','walnut']
		// options.theme = themes[Math.floor(Math.random() * themes.length)]
		// loadDie allows you to specify sides(dieType) and theme and returns the options you passed in
		// console.log("await loadDie", count)
		// const newDie = await Dice.loadDie({
		// 	...options,
		// 	assetPath: this.config.assetPath,
		// 	enableShadows: this.config.enableShadows,
		// 	lights: this.#lights,
		// 	scene: this.#scene
		// }).then( (response) =>  {
		// 	// after the die model and textures have loaded we can add the die to the scene for rendering
		// 	console.log(`creating die`, count)
		// 	return new Dice(response)
		// })

		console.log(`creating die`, count)

		const newDie = new Dice(options)

		console.log("die created", count)
		
		// save the die just created to the cache
		this.#dieCache.push(newDie)
		
		// tell the physics engine to roll this die type - which is a low poly collider
		this.#physicsWorkerPort.postMessage({
			action: "addDie",
			sides: options.sides,
			id: newDie.id
		})
	
		// for d100's we need to add an additional d10 and pair it up with the d100 just created
		if(options.sides === 100) {
			// assign the new die to a property on the d100 - spread the options in order to pass a matching theme
			newDie.d10Instance = await Dice.loadDie({...options, sides: 10}).then( response =>  {
				const d10Instance = new Dice(response)
				// identify the parent of this d10 so we can calculate the roll result later
				d10Instance.dieParent = newDie
				return d10Instance
			})
			// add the d10 to the cache and ask the physics worker for a collider
			this.#dieCache.push(newDie.d10Instance)
			this.#physicsWorkerPort.postMessage({
				action: "addDie",
				sides: 10,
				id: newDie.d10Instance.id
			})
		}
	
		// return the die instance
		return newDie
	
	}
	
	remove(data) {
	// remove from sleepercache
	this.#sleeperCache = this.#sleeperCache.filter((die) => {
		let match = die.config.groupId === data.groupId && die.config.rollId === data.rollId
		if(match){
			// remove the mesh from the scene
			die.mesh.dispose()
		}
		return !match
	})

	// step the animation forward
	this.#scene.render()
}
	
	updatesFromPhysics(data) {
		// get dice that are sleeping.
		const asleep = data.updates.asleep
		// loop through all the sleeping dice
		asleep.reverse().forEach(async (dieIndex) => {
			// remove the sleeping die from the dieCache. It's been removed from the physics simulation and will no longer send position updates in the data array
			const sleeper = this.#dieCache.splice(dieIndex,1)[0]
			// mark this die as asleep
			sleeper.asleep = true
			// cache all the dice that are asleep
			this.#sleeperCache.push(sleeper)
			// get die result now that it's asleep
			let result = await Dice.getRollResult(sleeper, this.#scene)
			// console.log(`result`, result)
			// special case for d100's since they are a pair of dice
			// d100's will have a d10Instance prop and the d10 they are paired with will have a dieParent prop
			if(sleeper.d10Instance || sleeper.dieParent) {
				// if one of the pair is asleep and the other isn't then it falls through without getting the roll result
				// otherwise both dice in the d100 are asleep and ready to calc their roll result
				if(sleeper?.d10Instance?.asleep || sleeper?.dieParent?.asleep) {
					const d100 = sleeper.config.sides === 100 ? sleeper : sleeper.dieParent
					const d10 = sleeper.config.sides === 10 ? sleeper : sleeper.d10Instance
					if (d10.result === 0 && d100.result === 0) {
					d100.result = 100; // 00 + 0 is 100 on a d100
					} else {
					d100.result = d100.result + d10.result
					}
					this.onRollResult({
						groupId: d100.config.groupId,
						rollId: d100.config.rollId,
						id: d100.id,
						result : d100.result
					})
				}
			} else {
				// turn 0's on a d10 into a 10
				if(sleeper.config.sides === 10 && sleeper.result === 0) {
					sleeper.result = 10
				}
				this.onRollResult({
					groupId: sleeper.config.groupId,
					rollId: sleeper.config.rollId,
					id: sleeper.id,
					result: sleeper.result
				})
			}
		})
	
		// any dice that are not asleep are still moving - pass the remaining physics data to our handler
		const updates = data.updates.movements
		// apply the dice position updates to the scene meshes
		this.handleUpdates(updates)
	}
	
	// handle the position updates from the physics worker. It's a simple flat array of numbers for quick and easy transfer
	handleUpdates(updates) {
		// move through the updates 7 at a time getting position and rotation values
		// const dieCacheLength = dieCache.length
		for (let i = 0, len = updates.length; i < len; i++) {
			if (!this.#dieCache[i]) break
			let [px,py,pz,qx,qy,qz,qw,id] = updates[i]
			let obj = this.#dieCache[i].mesh
			if(this.#dieCache[i].id !== id) {
				// alert that workers have fallen out of sync
				console.error("id does not match")
			}
			obj.position.set(px, py, pz)
			obj.rotationQuaternion.set(qx, qy, qz, qw)
		}
	}
	
	resize() {
		// redraw the dicebox
		this.#diceBox.create({aspect: this.#canvas.width / this.#canvas.height})
		this.#engine.resize()
	}
}

export default WorldOnscreen