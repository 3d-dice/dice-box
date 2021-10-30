import { createEngine } from './engine'
import { createScene } from './scene'
import { createCamera } from './camera'
import DiceBox from './DiceBox'
import { createLights } from './lights'
import Dice from './Dice'
class WorldOnscreen {
	constructor(options){
		this.initialized = this.initScene(options)
		this.dieCache = []
		this.sleeperCache = []
		this.count = 0
		this.dieRollTimer = []
		this.onInitComplete = () => {}
		this.onRollResult = () => {}
		this.onRollComplete = () => {}
	}
	
	// initialize the babylon scene
	
	async initScene(options) {
		this.canvas = options.canvas
		this.origin = options.options.id
	
		// set the config from World
		this.config = options.options
		// canvas.width = options.width
		// canvas.height = options.height
	
		this.engine = createEngine(this.canvas)
		this.scene = createScene({engine:this.engine})
		this.camera = createCamera({engine:this.engine, zoomLevel:this.config.zoomLevel, scene: this.scene})
		this.lights = createLights({enableShadows: this.config.enableShadows, scene: this.scene})
	
	
		// create the box that provides surfaces for shadows to render on
		this.diceBox = new DiceBox({
			...this.config,
			zoomLevel: this.config.zoomLevel,
			aspect: this.canvas.width / this.canvas.height,
			lights: this.lights,
			scene: this.scene
		})

		this.dice = new Dice()
		
		// loading all our dice models
		// we use to load these models individually as needed, but it's faster to load them all at once and prevents animation jank when rolling
		await this.dice.loadModels(this.config.assetPath, this.scene)
		
		// start the render engine
		// render()
	
		// init complete - let the world know
		// self.postMessage({action:"init-complete"})
		this.onInitComplete(true)
		return true
	}

	connect(port){
		this.physicsWorkerPort = port
		this.physicsWorkerPort.onmessage = (e) => {
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
		if(prevConfig.zoomLevel !== this.config.zoomLevel){
			this.diceBox.destroy()
			this.diceBox = new DiceBox({
				...this.config,
				zoomLevel: this.config.zoomLevel,
				aspect: this.canvas.width / this.canvas.height,
				lights: this.lights,
				scene: this.scene
			})
			this.camera.dispose()
			this.camera = createCamera({engine:this.engine, zoomLevel: this.config.zoomLevel})
		}
		if(prevConfig.enableShadows !== this.config.enableShadows) {
			Object.values(this.lights).forEach(light => light.dispose())
			this.lights = createLights({enableShadows: this.config.enableShadows})
		}
	}

	// all this does is start the render engine.
	render() {
		// document.body.addEventListener('click',()=>engine.stopRenderLoop())
		this.engine.runRenderLoop(this.renderLoop.bind(this))
		this.physicsWorkerPort.postMessage({
			action: "resumeSimulation",
		})
	}
	renderLoop() {
		// if no dice awake then stop the render loop and save some CPU power (unless we're in debug mode where we want the arc camera to continue working)
		if(this.sleeperCache.length !== 0 && this.dieCache.length === 0) {
			console.log(`no dice moving`)
			this.engine.stopRenderLoop()
			this.count = 0
			// stop the physics engine
			this.physicsWorkerPort.postMessage({
				action: "stopSimulation",
			})
			// post back to the world
			// self.postMessage({
			// 	action: "roll-complete"
			// })
			// TODO: custom event?
			this.onRollComplete()
		}
		// otherwise keep on rendering
		else {
			this.scene.render()
		}
	}

	clear() {
		if(!this.dieCache.length && !this.sleeperCache.length) {
			return
		}
		this.dieRollTimer.forEach(timer=>clearTimeout(timer))
		// stop anything that's currently rendering
		this.engine.stopRenderLoop()
		// clear all dice
		this.dieCache.forEach(die => die.mesh.dispose())
		this.sleeperCache.forEach(die => die.mesh.dispose())
		this.dice.resetCount()
		this.count = 0
	
		// step the animation forward
		this.scene.render()
	
		this.dieCache = []
		this.sleeperCache = []
	}

	add(options) {
		// space out adding the dice so they don't lump together too much
		this.dieRollTimer.push(setTimeout(() => {
			this._add(options)
		}, this.count++ * this.config.delay))
	}

	// add a die to the scene
	async _add(options) {
		if(this.engine.activeRenderLoops.length === 0) {
			this.render()
		}
		// const themes = ['galaxy','gemstone','glass','iron','nebula','sunrise','sunset','walnut']
		// options.theme = themes[Math.floor(Math.random() * themes.length)]
		// loadDie allows you to specify sides(dieType) and theme and returns the options you passed in
		const newDie = await this.dice.loadDie({...options, scene:this.scene}).then( response =>  {
			// after the die model and textures have loaded we can add the die to the scene for rendering
			if(!response.lights) {
				response.lights = this.lights
			}
			if(!response.enableShadows){
				response.enableShadows = this.config.enableShadows
			}
			return this.dice.createInstance(response)
		})
	
		// save the die just created to the cache
		this.dieCache.push(newDie)
	
		// tell the physics engine to roll this die type - which is a low poly collider
		this.physicsWorkerPort.postMessage({
			action: "addDie",
			sides: options.sides,
			id: newDie.id
		})
	
		// for d100's we need to add an additional d10 and pair it up with the d100 just created
		if(options.sides === 100) {
			// assign the new die to a property on the d100 - spread the options in order to pass a matching theme
			newDie.d10Instance = await this.dice.loadDie({...options, sides: 10}, this.scene).then( response =>  {
				const d10Instance = this.dice.createInstance(response, this.lights, this.config.enableShadows)
				// identify the parent of this d10 so we can calculate the roll result later
				d10Instance.dieParent = newDie
				return d10Instance
			})
			// add the d10 to the cache and ask the physics worker for a collider
			this.dieCache.push(newDie.d10Instance)
			this.physicsWorkerPort.postMessage({
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
	this.sleeperCache = this.sleeperCache.filter((die) => {
		let match = die.groupId === data.groupId && die.rollId === data.rollId
		if(match){
			// remove the mesh from the scene
			die.mesh.dispose()
		}
		return !match
	})

	// step the animation forward
	this.scene.render()
}
	
	updatesFromPhysics(data) {
		// get dice that are sleeping.
		const asleep = data.updates.asleep
		// loop through all the sleeping dice
		asleep.reverse().forEach(async (dieIndex,i) => {
			// remove the sleeping die from the dieCache. It's been removed from the physics simulation and will no longer send position updates in the data array
			const sleeper = this.dieCache.splice(dieIndex,1)[0]
			// mark this die as asleep
			sleeper.asleep = true
			// cache all the dice that are asleep
			this.sleeperCache.push(sleeper)
			// get die result now that it's asleep
			let result = await Dice.getRollResult(sleeper)
			// console.log(`result`, result)
			// special case for d100's since they are a pair of dice
			// d100's will have a d10Instance prop and the d10 they are paired with will have a dieParent prop
			if(sleeper.d10Instance || sleeper.dieParent) {
				// if one of the pair is asleep and the other isn't then it falls through without getting the roll result
				// otherwise both dice in the d100 are asleep and ready to calc their roll result
				if(sleeper?.d10Instance?.asleep || sleeper?.dieParent?.asleep) {
					const d100 = sleeper.sides === 100 ? sleeper : sleeper.dieParent
					const d10 = sleeper.sides === 10 ? sleeper : sleeper.d10Instance
					if (d10.result === 0 && d100.result === 0) {
					d100.result = 100; // 00 + 0 is 100 on a d100
					} else {
					d100.result = d100.result + d10.result
					}

					// self.postMessage({action:"roll-result", die: {
					// 	groupId: d100.groupId,
					// 	rollId: d100.rollId,
					// 	id: d100.id,
					// 	result : d100.result
					// }})
					this.onRollResult({
						groupId: d100.groupId,
						rollId: d100.rollId,
						id: d100.id,
						result : d100.result
					})
				}
			} else {
				// turn 0's on a d10 into a 10
				if(sleeper.sides === 10 && sleeper.result === 0) {
					sleeper.result = 10
				}

				// self.postMessage({action:"roll-result", die: {
				// 	groupId: sleeper.groupId,
				// 	rollId: sleeper.rollId,
				// 	id: sleeper.id,
				// 	result: sleeper.result
				// }})
				this.onRollResult({
					groupId: sleeper.groupId,
					rollId: sleeper.rollId,
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
			if (!this.dieCache[i]) break
			let [px,py,pz,qx,qy,qz,qw,id] = updates[i]
			let obj = this.dieCache[i].mesh
			if(this.dieCache[i].id !== id) {
				console.error("id does not match")
			}
			obj.position.set(px, py, pz)
			obj.rotationQuaternion.set(qx, qy, qz, qw)
		}
	}
	
	resize(data) {
		// redraw the dicebox
		this.diceBox.create({aspect: this.canvas.width / this.canvas.height})
		this.engine.resize()
	}
}

export default WorldOnscreen