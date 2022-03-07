import { Camera, Engine, Scene } from '@babylonjs/core'

import { createCamera } from './camera'
import { createEngine } from './engine'
import { createLights } from './lights'
import { createScene } from './scene'
import { loadTheme } from './Dice/themes'
import Dice from './Dice'
import DiceBox from './DiceBox'

import { defaultOptions as defaults } from '../defaultOptions'

import { 
	configType,
	connectTypes,
	DiceConstructorType,
	lightsType,
	loadDieType,
	onscreenOnMessageType,
	rollScreenType,
	screenOptionsType 
} from '../types'

class WorldOnscreen {
	config?: configType
	initialized?: Promise<void> = undefined
	#dieCache: { [key: string | number]: Dice} = {}
	#count = 0
	#sleeperCount = 0
	#dieRollTimer: NodeJS.Timeout[] = []
	#canvas!: HTMLCanvasElement
	#engine!: Engine
	#scene!: Scene
	#camera!: Camera
	#lights!: lightsType
	#diceBox!: DiceBox
	#physicsWorkerPort!: connectTypes
	onInitComplete = (arg: boolean) => {}
	onRollResult = (arg: unknown) => {}
	onRollComplete = () => {}
	diceBufferView = new Float32Array(8000)
	init: unknown

	constructor(options: screenOptionsType){
		this.initialized = this.initScene(options)
	}
	
	// initialize the babylon scene
	async initScene(config: screenOptionsType) {
		this.#canvas  = config.canvas
	
		// set the config from World
		this.config = config.options
	
		// setup babylonJS scene
		this.#engine  = createEngine(this.#canvas )
		this.#scene = createScene({engine:this.#engine })
		this.#camera  = createCamera({
			engine:this.#engine , 
			scene: this.#scene,
			zoomLevel:this.config?.zoomLevel ?? defaults.zoomLevel, 
		})
		this.#lights  = createLights({
			enableShadows: this.config?.enableShadows ?? defaults.enableShadows, 
			scene: this.#scene
		})
	
		// create the box that provides surfaces for shadows to render on
		this.#diceBox  = new DiceBox({
			aspect: this.#canvas.width / this.#canvas.height,
			enableShadows: this.config?.enableShadows ?? defaults.enableShadows,
			lights: this.#lights,
			scene: this.#scene,
			zoomLevel: this.config?.zoomLevel ?? defaults.zoomLevel,
		})
		
		// loading all our dice models
		// we use to load these models individually as needed, but it's faster to load them all at once and prevents animation jank when rolling
		const originPathString = this.config?.origin ?? defaults.origin
		const assestPathString = this.config?.assetPath ?? defaults.assetPath
		await Dice.loadModels({
			assetPath: originPathString + assestPathString,
			scene: this.#scene
		})

		this.#physicsWorkerPort.postMessage({
			action: "initBuffer",
			diceBuffer: this.diceBufferView.buffer
		}, [this.diceBufferView.buffer])
	
		// init complete - let the world know
		this.onInitComplete(true)
	}

	connect<T extends connectTypes>(port: T){
		this.#physicsWorkerPort = port
		this.#physicsWorkerPort.onmessage = (e: onscreenOnMessageType) => {
        switch (e.data.action) {
          case "updates": 
						// dice status/position updates from physics worker
						this.updatesFromPhysics(e.data.diceBuffer)
            break;
        
          default:
            console.error("Onscreen World: action from physicsWorker not found in offscreen worker")
            break;
        }
      }
	}

	updateConfig(options: configType){
		const prevConfig = this.config
		this.config = options
		// check if zoom level has changed
		if(prevConfig?.zoomLevel !== this.config?.zoomLevel){

			// redraw the DiceBox for shadows shader
			this.#diceBox.destroy()
			this.#diceBox  = new DiceBox({
				aspect: this.#canvas.width / this.#canvas.height,
				enableShadows: this.config?.enableShadows ??  defaults.enableShadows,
				lights: this.#lights,
				scene: this.#scene,
				zoomLevel: this.config?.zoomLevel ?? defaults.zoomLevel,
			})
			// redraw the camera which changes position based on zoomLevel value
			this.#camera.dispose()
			this.#camera  = createCamera({engine:this.#engine , zoomLevel: this.config.zoomLevel})
		}
		// check if shadows setting has changed
		if(prevConfig?.enableShadows !== this.config.enableShadows) {
			// regenerate the lights
			Object.values(this.#lights ).forEach(light => light.dispose())
			this.#lights  = createLights({
				enableShadows: this.config.enableShadows, 
				scene: this.#scene
			})
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

	async loadTheme(theme: string) {
		const originPathString = this.config ? this.config.origin : defaults.origin
		const assetPathString = this.config ? this.config.assetPath : defaults.assetPath
		await loadTheme(theme, originPathString + assetPathString, this.#scene)
	}

	clear() {
		if(!Object.keys(this.#dieCache).length && !this.#sleeperCount) {
			return
		}
		if(this.diceBufferView.byteLength){
			this.diceBufferView.fill(0)
		}
		this.#dieRollTimer.forEach(timer => clearTimeout( timer ))
		// stop anything that's currently rendering
		this.#engine.stopRenderLoop()
		// remove all dice
		Object.values(this.#dieCache).forEach(die => die.mesh?.dispose())
		
		// reset storage
		this.#dieCache = {}
		this.#count = 0
		this.#sleeperCount = 0

		// step the animation forward
		this.#scene.render()
	}

	add(options: rollScreenType) {
		const loadDieOptions = { ...options, scene: this.#scene }
		// loadDie allows you to specify sides(dieType) and theme and returns the options you passed in
		Dice.loadDie( loadDieOptions ).then(resp => {
			const delay = this.config ? this.config.delay : defaults.delay
			// space out adding the dice so they don't lump together too much
			this.#dieRollTimer.push(setTimeout(() => {
				this.#add(resp)
			}, this.#count++ * delay))
		})
	}

	// add a die to the scene
	async #add(options: loadDieType) {
		if(this.#engine.activeRenderLoops.length === 0) {
			this.render()
		}

		const diceOptions: DiceConstructorType = {
			...options,
			assetPath: this.config?.assetPath ?? defaults.assetPath,
			enableShadows: this.config?.enableShadows ?? defaults.enableShadows,
			lights: this.#lights,
		}
		
		const newDie = new Dice( diceOptions )
		
		// save the die just created to the cache
		this.#dieCache[newDie.id] = newDie
		
		// tell the physics engine to roll this die type - which is a low poly collider
		this.#physicsWorkerPort.postMessage({
			action: "addDie",
			sides: options.sides,
			id: newDie.id
		})
	
		// for d100's we need to add an additional d10 and pair it up with the d100 just created
		if(options.sides === 100) {
			const id = Number(newDie.id) + 10000
			// assign the new die to a property on the d100 - spread the options in order to pass a matching theme
			newDie.d10Instance = await Dice.loadDie({...diceOptions, id, sides: 10 }).then(response =>  {
				const d10Instance = new Dice( response )
				// identify the parent of this d10 so we can calculate the roll result later
				d10Instance.dieParent = newDie
				return d10Instance
			})
			// add the d10 to the cache and ask the physics worker for a collider
			this.#dieCache[`${newDie.d10Instance.id}`] = newDie.d10Instance
			this.#physicsWorkerPort.postMessage({
				action: "addDie",
				sides: 10,
				id: newDie.d10Instance.id
			})
		}
	
		// return the die instance
		return newDie
	
	}
	
	remove(data: { id: string | number }) {
	// remove die
	this.#dieCache[data.id].mesh?.dispose()
	// delete entry
	delete this.#dieCache[data.id]
	// decrement count
	this.#sleeperCount--

	// step the animation forward
	this.#scene.render()
}
	
	updatesFromPhysics(buffer: SharedArrayBuffer) {
		this.diceBufferView = new Float32Array(buffer)
		let bufferIndex = 1

		// loop will be based on diceBufferView[0] value which is the bodies length in physics.worker
	for (let i = 0, len = this.diceBufferView[0]; i < len; i++) {
		if(!Object.keys(this.#dieCache).length){
			continue
		}
		const die = this.#dieCache[`${this.diceBufferView[bufferIndex]}`]
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

			die.mesh?.position.set(px, py, pz)
			die.mesh?.rotationQuaternion?.set(qx, qy, qz, qw)
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
	async handleAsleep(die: Dice){
		// mark this die as asleep
		die.asleep = true
	
		// get the roll result for this die
		let result = await Dice.getRollResult(die)

		if(result === undefined) {
			console.log("No result. This die needs a reroll.")
		}
	
		if(die.d10Instance || die.dieParent) {
			// if one of the pair is asleep and the other isn't then it falls through without getting the roll result
			// otherwise both dice in the d100 are asleep and ready to calc their roll result
			if(die?.d10Instance?.asleep || die?.dieParent?.asleep) {
				const d100 = die.config.sides === 100 ? die : die.dieParent
				const d10 = die.config.sides === 10 ? die : die.d10Instance
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
			if(die.config.sides === 10 && die.result === 0) {
				die.result = 10
			}
			this.onRollResult({
				groupId: die.config.groupId,
				rollId: die.config.rollId,
				id: die.id,
				result: die.result
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