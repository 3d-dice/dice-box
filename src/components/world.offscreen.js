import worldWorker from './offscreenCanvas.worker?worker'

class WorldOffScreen{
	constructor(options){
		this.initialized = false
		this.onInitComplete = () => {}
		this.onRollResult = () => {}
		this.onRollComplete = () => {}


		this.offscreenCanvas = options.canvas.transferControlToOffscreen()

		// initialize 3D World in which BabylonJS runs
		this.offscreenWorker = new worldWorker()
		// need to initialize the web worker and get confirmation that initialization is complete before other scripts can run
		// set a property on the worker to a promise that is resolve when the proper message is returned from the worker
		this.offscreenWorker.init = new Promise((resolve, reject) => {
			this.offscreenWorkerInit = resolve
		})

		this.initScene(options)
	}

	// initialize the babylon scene
	async initScene(options) {
		let canvas = options.canvas
	
		// set the config from World
		this.config = options.options

		// initalize the offscreen worker
		this.offscreenWorker.postMessage({
			action: "init",
			canvas: this.offscreenCanvas,
			width: canvas.clientWidth,
			height: canvas.clientHeight,
			options: this.config,
		}, [this.offscreenCanvas])

		// handle messages from offscreen BabylonJS World
		this.offscreenWorker.onmessage = (e) => {
			switch( e.data.action ) {
				case "init-complete":
					this.offscreenWorkerInit() //fulfill promise so other things can run
					break;
				case 'roll-result':
					const die = e.data.die
					// map die results back to our rollData
					// this.rollData[die.groupId].rolls[die.rollId].result = die.result
					// TODO: die should have 'sides' or is that unnecessary data passed between workers?
					this.onRollResult(die)
					break;
				case 'roll-complete':
					// this.onRollComplete(this.getRollResults())
					this.onRollComplete()
					break;
			}
		}
		await Promise.all([this.offscreenWorker.init])

		this.onInitComplete(true)
	}

	connect(port){
		// Setup the connection: Port 1 is for this.offscreenWorker
		this.offscreenWorker.postMessage({
			action : "connect",
			port
		},[ port ])
	}

	updateConfig(options){
		this.offscreenWorker.postMessage({action: "updateConfig", options});
	}

	resize(options){
		this.offscreenWorker.postMessage({action: "resize", ...options});
	}

	clear(){
		this.offscreenWorker.postMessage({action: "clearDice"})
	}

	add(options){
		this.offscreenWorker.postMessage({
			action: "addDie",
			options // TODO: other methods do not pass options object. Instead they are spread out
		})
	}

	remove(options){
		// remove the die from the render
		this.offscreenWorker.postMessage({action: "removeDie", ...options})
	}
}

export default WorldOffScreen