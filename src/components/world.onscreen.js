import { Vector3 } from '@babylonjs/core/Maths/math'
import { createEngine } from './engine'
import { createScene } from './scene'
import { createCamera } from './camera'
import { createLights } from './lights'
import DiceBox from './DiceBox'
import Dice from './Dice'
import { loadTheme } from './Dice/themes'

class WorldOnscreen {
	config
	initialized = false
	#dieCache = {}
	#count = 0
	#sleeperCount = 0
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
	diceBufferView = new Float32Array(8000)

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
		this.#camera  = createCamera({engine:this.#engine, scene: this.#scene})
		this.#lights  = createLights({enableShadows: this.config.enableShadows, scene: this.#scene})
	
		// create the box that provides surfaces for shadows to render on
		this.#diceBox  = new DiceBox({
			enableShadows: this.config.enableShadows,
			aspect: this.#canvas.width / this.#canvas.height,
			lights: this.#lights,
			scene: this.#scene
		})
		
		// loading all our dice models
		// we use to load these models individually as needed, but it's faster to load them all at once and prevents animation jank when rolling
		await Dice.loadModels({
			assetPath: this.config.origin + this.config.assetPath,
			scene: this.#scene,
			scale: this.config.scale
		})

		this.#physicsWorkerPort.postMessage({
			action: "initBuffer",
			diceBuffer: this.diceBufferView.buffer
		}, [this.diceBufferView.buffer])
	
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
						this.updatesFromPhysics(e.data.diceBuffer)
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
		// check if shadows setting has changed
		if(prevConfig.enableShadows !== this.config.enableShadows) {
			// regenerate the lights
			Object.values(this.#lights ).forEach(light => light.dispose())
			this.#lights  = createLights({enableShadows: this.config.enableShadows})
		}
		if(prevConfig.scale !== this.config.scale) {
			Object.values(this.#dieCache).forEach(({mesh}) => {
				mesh.scaling = new Vector3(this.config.scale,this.config.scale,this.config.scale)
			})
		}
	}

	// all this does is start the render engine.
	render(anustart) {
		// document.body.addEventListener('click',()=>engine.stopRenderLoop())
		this.#engine.runRenderLoop(this.renderLoop.bind(this))
		this.#physicsWorkerPort.postMessage({
			action: "resumeSimulation",
			anustart
		})
	}

	renderLoop() {
		// if no dice are awake then stop the render loop and save some CPU power
		if(this.#sleeperCount && this.#sleeperCount === Object.keys(this.#dieCache).length) {
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

	async loadTheme(theme) {
		await loadTheme(theme, this.config.origin + this.config.assetPath, this.#scene)
	}

	clear() {
		if(!Object.keys(this.#dieCache).length && !this.#sleeperCount) {
			return
		}
		if(this.diceBufferView.byteLength){
			this.diceBufferView.fill(0)
		}
		this.#dieRollTimer.forEach(timer=>clearTimeout(timer))
		// stop anything that's currently rendering
		this.#engine.stopRenderLoop()
		// remove all dice
		Object.values(this.#dieCache).forEach(die => die.mesh.dispose())
		
		// reset storage
		this.#dieCache = {}
		this.#count = 0
		this.#sleeperCount = 0

		// step the animation forward
		this.#scene.render()
	}

	add(options) {
		// loadDie allows you to specify sides(dieType) and theme and returns the options you passed in
		Dice.loadDie({
			...options,
			scene: this.#scene
		}).then(resp => {
			// space out adding the dice so they don't lump together too much
			this.#dieRollTimer.push(setTimeout(() => {
				this.#add(resp)
			}, this.#count++ * this.config.delay))
		})
	}

	// add a die to the scene
	async #add(options) {
		if(this.#engine.activeRenderLoops.length === 0) {
			this.render(options.anustart)
		}
		const diceOptions = {
			...options,
			assetPath: this.config.assetPath,
			enableShadows: this.config.enableShadows,
			scale: this.config.scale,
			lights: this.#lights,
		}
		
		const newDie = new Dice(diceOptions)
		
		// save the die just created to the cache
		this.#dieCache[newDie.id] = newDie
		
		// tell the physics engine to roll this die type - which is a low poly collider
		this.#physicsWorkerPort.postMessage({
			action: "addDie",
			sides: options.sides,
			scale: this.config.scale,
			id: newDie.id
		})
	
		// for d100's we need to add an additional d10 and pair it up with the d100 just created
		if(options.sides === 100) {
			// assign the new die to a property on the d100 - spread the options in order to pass a matching theme
			newDie.d10Instance = await Dice.loadDie({...diceOptions, sides: 10, id: newDie.id + 10000}).then( response =>  {
				const d10Instance = new Dice(response)
				// identify the parent of this d10 so we can calculate the roll result later
				d10Instance.dieParent = newDie
				return d10Instance
			})
			// add the d10 to the cache and ask the physics worker for a collider
			this.#dieCache[`${newDie.d10Instance.id}`] = newDie.d10Instance
			this.#physicsWorkerPort.postMessage({
				action: "addDie",
				sides: 10,
				scale: this.config.scale,
				id: newDie.d10Instance.id
			})
		}
	
		// return the die instance
		return newDie
	
	}
	
	remove(data) {
	// TODO: test this with exploding dice
	const dieData = this.#dieCache[data.id]
	
	// check if this is d100 and remove associated d10 first
	if(dieData.hasOwnProperty('d10Instance')){
		// remove die
		this.#dieCache[dieData.d10Instance.id].mesh.dispose()
		// delete entry
		delete this.#dieCache[dieData.d10Instance.id]
		// remove physics body
		this.#physicsWorkerPort.postMessage({
			action: "removeDie",
			id: dieData.d10Instance.id
    })
		// decrement count
		this.#sleeperCount--
	}

	// remove die
	this.#dieCache[data.id].mesh.dispose()
	// delete entry
	delete this.#dieCache[data.id]
	// decrement count
	this.#sleeperCount--

	// step the animation forward
	this.#scene.render()

	this.onDieRemoved(data.rollId)
}
	
	updatesFromPhysics(buffer) {
		this.diceBufferView = new Float32Array(buffer)
		let bufferIndex = 1

		// loop will be based on diceBufferView[0] value which is the bodies length in physics.worker
	for (let i = 0, len = this.diceBufferView[0]; i < len; i++) {
		if(!Object.keys(this.#dieCache).length){
			continue
		}
		const die = this.#dieCache[`${this.diceBufferView[bufferIndex]}`]
		if(!die) {
			console.log("Error: die not available in scene to animate")
			break
		}
		// if the first position index is -1 then this die has been flagged as asleep
		if(this.diceBufferView[bufferIndex + 1] === -1) {
			this.handleAsleep(die)
		} else {
			const px = this.diceBufferView[bufferIndex + 1]
			const py = this.diceBufferView[bufferIndex + 2]
			const pz = this.diceBufferView[bufferIndex + 3]
			const qx = this.diceBufferView[bufferIndex + 4]
			const qy = this.diceBufferView[bufferIndex + 5]
			const qz = this.diceBufferView[bufferIndex + 6]
			const qw = this.diceBufferView[bufferIndex + 7]

			die.mesh.position.set(px, py, pz)
			die.mesh.rotationQuaternion.set(qx, qy, qz, qw)
		}

		bufferIndex = bufferIndex + 8
	}

	// transfer the buffer back to physics worker
	requestAnimationFrame(()=>{
		this.#physicsWorkerPort.postMessage({
			action: "stepSimulation",
			diceBuffer: this.diceBufferView.buffer
		}, [this.diceBufferView.buffer])
	})
	}
	
	// handle the position updates from the physics worker. It's a simple flat array of numbers for quick and easy transfer
	async handleAsleep(die){
		// mark this die as asleep
		die.asleep = true
	
		// get the roll result for this die
		let result = await Dice.getRollResult(die)
		// TODO: catch error if no result is found
		if(result === undefined) {
			console.log("No result. This die needs a reroll.")
		}
	
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
	
	resize() {
		// redraw the dicebox
		this.#diceBox.create({aspect: this.#canvas.width / this.#canvas.height})
		this.#engine.resize()
	}
}

export default WorldOnscreen