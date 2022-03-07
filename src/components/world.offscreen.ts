// using vits.js worker import - this will be compiled away
//@ts-expect-error compile will resolve this
import worldWorker from './offscreenCanvas.worker?worker&inline' 

import { createUUID } from '../helpers'
import {
	configType,
	offscreenOnMessageType,
	screenOptionsType,
	offscreenPromiseType,
	offScreenResizeType,
	onRollResultDieType,
	rollType,
	rollScreenType,
 } from '../types'

class WorldOffScreen {
	initialized?: Promise<boolean> = undefined
	offscreenWorkerInit?: (value?: unknown) => void  = undefined
	themeLoadedInit: undefined
	pendingThemePromises: offscreenPromiseType[]  = []
	#offscreenCanvas
	#OffscreenWorker
	onInitComplete = (arg: boolean) => {} // init callback
	onRollResult = (die: onRollResultDieType) => {} // individual die callback
	onRollComplete = () => {} // roll group callback
	init: Promise<unknown> | undefined

	constructor(options: screenOptionsType){
		// transfer control offscreen

		//Ts error - Experimental feature, https://github.com/microsoft/TypeScript/issues/45745
		this.#offscreenCanvas = options.canvas.transferControlToOffscreen()

		// initialize 3D World in which BabylonJS runs
		this.#OffscreenWorker = new worldWorker()
		// need to initialize the web worker and get confirmation that initialization is complete before other scripts can run
		// set a property on the worker to a promise that is resolve when the proper message is returned from the worker
		this.#OffscreenWorker.init = new Promise((resolve, reject) => {
			this.offscreenWorkerInit = resolve
		})

		this.initialized = this.#initScene(options)
	}

	// initialize the babylon scene
	async #initScene(config: screenOptionsType) {
		// initalize the offscreen worker
		this.#OffscreenWorker.postMessage({
			action: "init",
			canvas: this.#offscreenCanvas,
			width: config.canvas.clientWidth,
			height: config.canvas.clientHeight,
			options: config.options,
		}, [this.#offscreenCanvas])

		// handle messages from offscreen BabylonJS World
		this.#OffscreenWorker.onmessage = (e: offscreenOnMessageType ) => {
			switch( e.data.action ) {
				case "init-complete":
					this.offscreenWorkerInit && this.offscreenWorkerInit() //fulfill promise so other things can run
					break;
				case "theme-loaded":
					const findPromise = this.pendingThemePromises.find((obj) => obj.id === e.data.id)
					findPromise?.promise()
					break;
				case 'roll-result':
					const die = e.data.die
					this.onRollResult(die)
					break;
				case 'roll-complete':
					this.onRollComplete()
					break;
			}
		}
		await Promise.all([this.#OffscreenWorker.init])

		this.onInitComplete(true)

		return true
	}

	connect(port: unknown){
		// Setup the connection: Port 1 is for this.#OffscreenWorker
		this.#OffscreenWorker.postMessage({
			action : "connect",
			port
		},[ port ])
	}

	updateConfig(options: configType){
		this.#OffscreenWorker.postMessage({action: "updateConfig", options});
	}

	resize(options: offScreenResizeType){
		this.#OffscreenWorker.postMessage({action: "resize", options});
	}

	async loadTheme(theme: string) {
		const id = createUUID()

		return new Promise((resolve, reject) => {
			this.#OffscreenWorker.postMessage({action: "loadTheme", id, theme})
			this.pendingThemePromises.push({
				id,
				promise: resolve
			})
		})
	}

	clear(){
		this.#OffscreenWorker.postMessage({action: "clearDice"})
	}

	add(options: rollScreenType){
		this.#OffscreenWorker.postMessage({action: "addDie", options})
	}

	remove(options: rollType){
		// remove the die from the render
		this.#OffscreenWorker.postMessage({action: "removeDie", options})
	}
}

export default WorldOffScreen